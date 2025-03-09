/**
 * API 통신을 처리하는 클래스
 */
class ApiService {
    constructor() {
        this.baseUrl = `${window.location.protocol}//${window.location.host}`;
        this.isServerAvailable = false;
        
        // 서버 상태 표시 요소
        this.serverIndicator = document.getElementById('server-indicator');
        this.serverStatusText = document.getElementById('server-status-text');
        
        // 초기화
        this.init();
    }
    
    /**
     * 초기화 함수
     */
    async init() {
        try {
            this.serverIndicator.classList.add('checking');
            this.serverStatusText.textContent = '서버 연결 확인 중...';
            
            // 서버 연결 확인
            await this.checkServer();
            
            this.serverIndicator.classList.remove('checking');
            this.serverIndicator.classList.add('online');
            this.serverStatusText.textContent = '서버 연결됨';
            this.isServerAvailable = true;
        } catch (error) {
            console.error('서버 연결 실패:', error);
            this.serverIndicator.classList.remove('checking');
            this.serverIndicator.classList.add('offline');
            this.serverStatusText.textContent = '서버 연결 실패. 로컬 모드로 실행 중';
            this.isServerAvailable = false;
        }
    }
    
    /**
     * 서버 연결 상태 확인
     */
    async checkServer() {
        try {
            const response = await fetch(`${this.baseUrl}/api/audio`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            return true;
        } catch (error) {
            throw new Error('서버에 연결할 수 없습니다.');
        }
    }
    
    /**
     * 음성 데이터 저장 API
     * @param {Float32Array} audioData - 음성 버퍼 데이터
     * @param {string} text - 인식된 텍스트
     * @returns {Promise} - API 응답 데이터
     */
    async saveAudio(audioData, text = '') {
        if (!this.isServerAvailable) {
            console.warn('서버를 사용할 수 없습니다. 로컬로만 저장됩니다.');
            return null;
        }
        
        try {
            // Float32Array를 Int16Array로 변환
            const pcmData = new Int16Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                pcmData[i] = Math.min(1, Math.max(-1, audioData[i])) * 32767;
            }
            
            // WAV 파일 생성
            const wavBlob = this.createWavBlob(pcmData);
            
            // Blob을 base64로 변환
            const base64Data = await this.blobToBase64(wavBlob);
            
            // API 요청
            const response = await fetch(`${this.baseUrl}/api/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: {
                        data: base64Data,
                        sampleRate: 16000,
                        channels: 1
                    },
                    text: text,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('음성 저장 오류:', error);
            return null;
        }
    }
    
    /**
     * 오디오 버퍼를 STT 처리하는 API
     * @param {Float32Array} audioData - 음성 버퍼 데이터
     * @returns {Promise<string>} - 인식된 텍스트
     */
    async transcribeAudio(audioData) {
        if (!this.isServerAvailable) {
            console.warn('서버를 사용할 수 없습니다. STT 처리를 수행할 수 없습니다.');
            return null;
        }
        
        try {
            // Float32Array를 Int16Array로 변환
            const pcmData = new Int16Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                pcmData[i] = Math.min(1, Math.max(-1, audioData[i])) * 32767;
            }
            
            // WAV 파일 생성
            const wavBlob = this.createWavBlob(pcmData);
            
            // Blob을 base64로 변환
            const base64Data = await this.blobToBase64(wavBlob);
            
            // API 요청
            const response = await fetch(`${this.baseUrl}/api/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: {
                        data: base64Data,
                        sampleRate: 16000,
                        channels: 1
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            const result = await response.json();
            return result.text || '';
        } catch (error) {
            console.error('STT 처리 오류:', error);
            return null;
        }
    }
    
    /**
     * 서버에 저장된 음성 목록 조회
     * @returns {Promise<Array>} - 음성 목록
     */
    async getAudioList() {
        if (!this.isServerAvailable) {
            console.warn('서버를 사용할 수 없습니다.');
            return [];
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/api/audio`);
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error('음성 목록 조회 오류:', error);
            return [];
        }
    }
    
    /**
     * Blob을 base64 문자열로 변환
     * @param {Blob} blob - 변환할 Blob 객체
     * @returns {Promise<string>} - base64 문자열
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // data:audio/wav;base64, 부분 제거
                const base64data = reader.result.split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    /**
     * WAV Blob 생성
     * @param {Int16Array} samples - PCM 샘플 데이터
     * @returns {Blob} - WAV Blob
     */
    createWavBlob(samples) {
        // WAV 헤더 생성
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);
        
        // RIFF 청크
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        
        // fmt 청크
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true);
        view.setUint32(28, 16000 * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        
        // data 청크
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);
        
        // WAV 파일 생성
        const wav = new Blob([buffer, samples.buffer], { type: 'audio/wav' });
        return wav;
    }
    
    /**
     * 문자열을 DataView에 쓰기
     * @param {DataView} view - 대상 DataView
     * @param {number} offset - 시작 오프셋
     * @param {string} string - 쓸 문자열
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

// 글로벌 API 서비스 인스턴스 생성
const apiService = new ApiService(); 