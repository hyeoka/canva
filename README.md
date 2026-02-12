# Canva Paste Position Locker (Chrome Extension)

Canva 디자인 편집기에서 요소를 복사(`Ctrl/Cmd + C`)하고 붙여넣기(`Ctrl/Cmd + V`)하면,
붙여넣은 요소가 원본과 다른 위치로 생성되는 문제를 줄이기 위한 확장 프로그램입니다.

## 동작 방식

1. 복사 시점에 현재 선택 요소의 화면 좌표(`x`, `y`)를 기록합니다.
2. 붙여넣기 후 새로 선택된 요소를 감지합니다.
3. 새 요소 좌표와 원본 좌표 차이(`dx`, `dy`)를 계산합니다.
4. CSS transform을 보정해 원본 위치로 이동시킵니다.

> Canva 내부 DOM/렌더링 구조가 변경되면 선택 요소 탐지 로직이 영향을 받을 수 있습니다.

## 설치 방법

1. 이 폴더를 로컬에 준비합니다.
2. Chrome에서 `chrome://extensions` 접속
3. 우측 상단 **개발자 모드** 활성화
4. **압축해제된 확장 프로그램을 로드** 클릭
5. 이 저장소 폴더(`/workspace/canva`)를 선택

## 파일 구성

- `manifest.json`: 확장 메타 정보 및 content script 주입 설정
- `content.js`: 복사/붙여넣기 감지 및 좌표 정렬 핵심 로직

