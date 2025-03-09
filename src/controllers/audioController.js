const fs = require('fs');
const path = require('path');
const config = require('../config');
const audioService = require('../services/audioService');

// 음성 데이터 저장 컨트롤러
const saveAudio = (req, res) => {
  try {
    const { audio, text, timestamp } = req.body;
    
    if (!audio || !audio.data) {
      return res.status(400).json({ error: '음성 데이터가 없습니다.' });
    }
    
    // Base64 데이터를 바이너리로 변환
    const audioData = Buffer.from(audio.data, 'base64');
    
    const result = audioService.saveAudioData(audioData, text, timestamp);
    
    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('음성 데이터 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 음성 파일 목록 가져오기 컨트롤러
const getAudioList = (req, res) => {
  try {
    const files = audioService.getAudioFiles();
    res.json({ files });
  } catch (error) {
    console.error('음성 파일 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 특정 음성 파일 가져오기 컨트롤러
const getAudioFile = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(config.AUDIO_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
  
  res.sendFile(filePath);
};

// 음성 데이터 STT 처리 컨트롤러
const transcribeAudio = async (req, res) => {
  try {
    const { audio } = req.body;
    
    if (!audio || !audio.data) {
      return res.status(400).json({ error: '음성 데이터가 없습니다.' });
    }
    
    // Base64 데이터를 바이너리로 변환
    const audioData = Buffer.from(audio.data, 'base64');
    
    try {
      const result = audioService.processAudioForTranscription(audioData);
      return res.json(result);
    } catch (error) {
      console.error('파일 처리 오류:', error);
      
      // 오류 응답
      res.status(500).json({ 
        error: '음성 파일 처리 중 오류가 발생했습니다.',
        details: error.message
      });
    }
  } catch (error) {
    console.error('요청 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

module.exports = {
  saveAudio,
  getAudioList,
  getAudioFile,
  transcribeAudio
}; 