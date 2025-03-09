const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');

// 음성 데이터 저장 API
router.post('/', audioController.saveAudio);

// 저장된 음성 파일 목록 가져오기
router.get('/', audioController.getAudioList);

// 특정 음성 파일 가져오기
router.get('/:filename', audioController.getAudioFile);

// 음성 데이터 STT 처리 API
router.post('/transcribe', audioController.transcribeAudio);

module.exports = router; 