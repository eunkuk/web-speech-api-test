const express = require('express');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const config = require('./src/config');
const audioRoutes = require('./src/routes/audio');

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

// 앱 초기화
const app = express();

// 필요한 디렉토리 생성
const dataDir = path.join(__dirname, 'src', 'data');
const audioDir = path.join(dataDir, 'audio');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// JSON 파싱 설정
app.use(express.json({ limit: '50mb' }));

// 루트 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 오디오 라우트 등록
app.use('/api/audio', audioRoutes);

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 