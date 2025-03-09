const express = require('express');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const config = require('./config');
const audioRoutes = require('./routes/audio');

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

// 앱 초기화
const app = express();

// 필요한 디렉토리 생성
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(config.AUDIO_DIR)) {
  fs.mkdirSync(config.AUDIO_DIR);
}

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSON 파싱 설정
app.use(express.json({ limit: '50mb' }));

// 루트 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 오디오 라우트 등록
app.use('/api/audio', audioRoutes);

// 서버 시작
app.listen(config.PORT, () => {
  console.log(`서버가 http://localhost:${config.PORT} 에서 실행 중입니다.`);
}); 