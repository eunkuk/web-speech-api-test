const fs = require('fs');
const path = require('path');
const config = require('../config');
const ffmpeg = require('fluent-ffmpeg');

// 음성 데이터 저장
const saveAudioData = (audioData, text, timestamp) => {
  const filename = `speech_${Date.now()}.wav`;
  const filePath = path.join(config.AUDIO_DIR, filename);
  
  // 파일 저장
  fs.writeFileSync(filePath, audioData);
  
  // 메타데이터 저장
  const metaFilePath = path.join(config.AUDIO_DIR, `${filename}.json`);
  fs.writeFileSync(metaFilePath, JSON.stringify({
    text,
    timestamp,
    length: audioData.length,
    created: new Date().toISOString()
  }));
  
  return {
    filename,
    path: `/api/audio/${filename}`
  };
};

// 음성 파일 목록 가져오기
const getAudioFiles = () => {
  return fs.readdirSync(config.AUDIO_DIR)
    .filter(file => file.endsWith('.wav'))
    .map(file => {
      const filename = file;
      const metaFilePath = path.join(config.AUDIO_DIR, `${filename}.json`);
      let metadata = {};
      
      if (fs.existsSync(metaFilePath)) {
        metadata = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
      }
      
      return {
        filename,
        url: `/api/audio/${filename}`,
        ...metadata
      };
    })
    .sort((a, b) => {
      // 시간 역순 정렬
      return new Date(b.timestamp || b.created) - new Date(a.timestamp || a.created);
    });
};

// 임시 음성 파일 처리
const processAudioForTranscription = (audioData) => {
  const tempFilename = `temp_${Date.now()}.wav`;
  const tempFilePath = path.join(config.AUDIO_DIR, tempFilename);
  
  fs.writeFileSync(tempFilePath, audioData);
  console.log('음성 파일이 저장되었습니다:', tempFilePath);
  
  // 임시 파일 삭제
  fs.unlinkSync(tempFilePath);
  
  return {
    success: true,
    text: "서버 측 STT 처리가 비활성화되었습니다. 클라이언트 측 Web Speech API를 사용하세요.",
    source: 'server'
  };
};

module.exports = {
  saveAudioData,
  getAudioFiles,
  processAudioForTranscription
}; 