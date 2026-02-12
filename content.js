(() => {
  if (!location.hostname.includes("canva.com")) return;

  const DEBUG = false;
  const log = (...args) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log("[CanvaPastePositionLocker]", ...args);
    }
  };

  const state = {
    copied: null,
    pastePending: false,
    lastKnownSelection: null,
  };

  const SELECTOR_CANDIDATES = [
    "[aria-selected='true']",
    "[data-selected='true']",
    "[data-testid*='selected']",
    "[class*='selected']",
    "[class*='Selected']",
    "[class*='selection']",
    "[class*='Selection']",
  ];

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getCandidateElements() {
    const unique = new Set();
    for (const selector of SELECTOR_CANDIDATES) {
      document.querySelectorAll(selector).forEach((el) => unique.add(el));
    }
    return [...unique].filter(isVisible);
  }

  function pickBestElement(elements) {
    if (!elements.length) return null;
    return elements
      .map((el) => ({ el, area: el.getBoundingClientRect().width * el.getBoundingClientRect().height }))
      .sort((a, b) => b.area - a.area)[0].el;
  }

  function getSelectedElement() {
    return pickBestElement(getCandidateElements());
  }

  function getElementSignature(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      el,
      rect,
      key:
        el.getAttribute("data-id") ||
        el.getAttribute("data-testid") ||
        el.id ||
        `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`,
    };
  }

  function parseTransform(transformText) {
    if (!transformText || transformText === "none") {
      return { x: 0, y: 0, raw: "" };
    }

    const matrixMatch = transformText.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
      const values = matrixMatch[1].split(",").map((v) => Number(v.trim()));
      if (values.length === 6 && values.every((v) => Number.isFinite(v))) {
        return {
          x: values[4],
          y: values[5],
          raw: transformText,
          a: values[0],
          b: values[1],
          c: values[2],
          d: values[3],
        };
      }
    }

    const translateMatch = transformText.match(/translate(?:3d)?\(([-\d.]+)px(?:,\s*([-\d.]+)px)?/i);
    if (translateMatch) {
      return {
        x: Number(translateMatch[1]) || 0,
        y: Number(translateMatch[2]) || 0,
        raw: transformText,
      };
    }

    return { x: 0, y: 0, raw: transformText };
  }

  function buildMatrixTransform(parsed, newX, newY) {
    if ([parsed.a, parsed.b, parsed.c, parsed.d].every((v) => typeof v === "number")) {
      return `matrix(${parsed.a}, ${parsed.b}, ${parsed.c}, ${parsed.d}, ${newX}, ${newY})`;
    }

    if (parsed.raw && /translate/i.test(parsed.raw)) {
      return parsed.raw
        .replace(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*([-\d.]+)px\)/i, `translate3d(${newX}px, ${newY}px, $3px)`)
        .replace(/translate\(([-\d.]+)px(?:,\s*([-\d.]+)px)?\)/i, `translate(${newX}px, ${newY}px)`);
    }

    return `translate(${newX}px, ${newY}px)`;
  }

  function moveElementByDelta(el, dx, dy) {
    if (!el || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;

    const style = window.getComputedStyle(el);
    const parsed = parseTransform(style.transform);
    const newX = parsed.x + dx;
    const newY = parsed.y + dy;
    const newTransform = buildMatrixTransform(parsed, newX, newY);

    el.style.transform = newTransform;
    log("Applied transform", { newTransform, dx, dy, el });
    return true;
  }

  function captureCopySource() {
    const selected = getSelectedElement();
    if (!selected) {
      state.copied = null;
      return;
    }

    state.copied = getElementSignature(selected);
    state.lastKnownSelection = state.copied;
    log("Captured copy source", state.copied);
  }

  function findPastedTarget() {
    const current = getElementSignature(getSelectedElement());
    if (!current) return null;

    if (!state.copied) return current;

    if (current.key !== state.copied.key) return current;

    const movedDistance =
      Math.abs(current.rect.left - state.copied.rect.left) + Math.abs(current.rect.top - state.copied.rect.top);
    if (movedDistance > 2) return current;

    return null;
  }

  function alignPastedElement() {
    if (!state.copied) return;

    let attempts = 0;
    const maxAttempts = 20;

    const timer = setInterval(() => {
      attempts += 1;
      const target = findPastedTarget();
      if (!target) {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          state.pastePending = false;
        }
        return;
      }

      const dx = state.copied.rect.left - target.rect.left;
      const dy = state.copied.rect.top - target.rect.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        clearInterval(timer);
        state.pastePending = false;
        return;
      }

      moveElementByDelta(target.el, dx, dy);
      clearInterval(timer);
      state.pastePending = false;
      log("Pasted element aligned", { dx, dy });
    }, 60);
  }

  function isMetaOrCtrl(event) {
    return event.metaKey || event.ctrlKey;
  }

  document.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();

      if (isMetaOrCtrl(event) && key === "c") {
        captureCopySource();
        return;
      }

      if (isMetaOrCtrl(event) && key === "v") {
        state.pastePending = true;
        setTimeout(alignPastedElement, 20);
      }
    },
    true,
  );

  document.addEventListener(
    "copy",
    () => {
      captureCopySource();
    },
    true,
  );

  document.addEventListener(
    "paste",
    () => {
      state.pastePending = true;
      setTimeout(alignPastedElement, 20);
    },
    true,
  );

  const observer = new MutationObserver(() => {
    const selected = getElementSignature(getSelectedElement());
    if (selected) state.lastKnownSelection = selected;

    if (state.pastePending) {
      alignPastedElement();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-selected", "data-selected"],
  });

  log("Extension initialized");
})();
