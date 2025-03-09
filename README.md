# 음성 감지 & STT 변환 애플리케이션

CursorAI를 활용해 작성한 VAD(Voice Activity Detection) 기반 Web Speech API STT(Speech-to-Text) 테스트 모듈 

## 주요 기능

- **실시간 음성 감지**: Silero VAD 모델을 통해 정확한 음성 감지
- **음성 텍스트 변환**: Web Speech API를 통한 STT 기능
- **서버 저장 기능**: 감지된 음성 데이터를 서버에 저장 및 관리
- **음성 히스토리**: 로컬 및 서버에 저장된 음성 히스토리 관리
- **재생 기능**: 저장된 음성 재생 지원
- **다양한 설정**: 음성 감지 매개변수 실시간 조정 가능

## 시스템 요구사항

- Node.js 14.x 이상
- 최신 웹 브라우저 (Chrome, Firefox, Edge 권장)
- 마이크 권한 필요

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 애플리케이션 실행

```bash
npm start
```

서버가 시작되면 `http://localhost:3000`에서 애플리케이션에 접속할 수 있습니다.

## 개발 모드로 실행

변경 사항이 있을 때 자동으로 서버를 재시작하려면:

```bash
npm run dev
```

## 폴더 구조

```
root/
├── public/
│   ├── index.html         # 메인 HTML 파일
│   ├── styles/
│   │   └── style.css      # 스타일시트
│   └── scripts/
│       ├── script.js      # 메인 자바스크립트 (음성 감지 및 UI 로직)
│       └── api.js         # 서버 통신 관련 기능
├── src/
│   ├── config/
│   │   └── index.js       # 서버 설정 (포트, 디렉토리 경로 등)
│   ├── controllers/
│   │   └── audioController.js  # 오디오 관련 요청 처리 컨트롤러
│   ├── data/
│   │   └── audio/         # 저장된 오디오 파일 디렉토리
│   ├── routes/
│   │   └── audio.js       # 오디오 관련 API 라우트 정의
│   ├── services/
│   │   └── audioService.js # 오디오 처리 비즈니스 로직
│   └── server.js          # 메인 서버 파일
├── package.json           # 프로젝트 의존성 정의
└── README.md              # 프로젝트 설명서
```

## 사용 방법

1. "시작" 버튼을 클릭하여 음성 감지를 시작합니다.
2. 말을 하면 자동으로 음성이 감지되고 텍스트로 변환됩니다.
3. 감지된 음성은 히스토리에 저장되며, 재생할 수 있습니다.
4. "설정" 버튼을 클릭하여 VAD 옵션을 조정할 수 있습니다.
5. 로컬/서버 탭을 전환하여 서버에 저장된 음성도 확인할 수 있습니다.

## VAD 설정 옵션

- **감지 임계값**: 음성으로 판단하는 기준값 (기본값: 0.75)
- **최소 음성 프레임**: 음성으로 감지하기 위한 최소 연속 프레임 수 (기본값: 5)
- **양성 음성 임계값**: 음성으로 판단하는 양성 임계값 (기본값: 0.5)
- **음성 임계값**: 음성으로 판단하는 음성 임계값 (기본값: 0.5)
- **음성 이전 패딩 프레임**: 음성 감지 시작 전에 추가할 프레임 수 (기본값: 10)

## STT 처리 방식

이 애플리케이션은 Web Speech API를 사용하여 브라우저에서 직접 음성을 텍스트로 변환합니다:

- **처리 방식**: 클라이언트 측 처리 (브라우저 내장 기능 사용)
- **장점**: 별도의 서버 설정 불필요, 빠른 응답 속도
- **단점**: 브라우저 지원 여부에 따라 기능 제한, 정확도 차이 있음

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript, Web Speech API
- **백엔드**: Node.js, Express
- **음성 감지**: @ricky0123/vad, ONNX Runtime Web
- **음성 인식**: Web Speech API
- **오디오 처리**: Web Audio API, FFmpeg
