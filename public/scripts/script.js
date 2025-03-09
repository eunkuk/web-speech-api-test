document.addEventListener('DOMContentLoaded', () => {
    // 요소 가져오기
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const voiceHistoryContainer = document.getElementById('voice-history');
    const serverVoiceHistoryContainer = document.getElementById('server-voice-history');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const refreshServerBtn = document.getElementById('refresh-server-btn');

    // 탭 관련 요소
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // 설정 모달 관련 요소
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveSettingsBtn = document.getElementById('save-settings');
    const saveToServerCheckbox = document.getElementById('save-to-server');

    // 슬라이더 요소와 값 표시 요소 - 상단으로 이동
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('threshold-value');
    const minSpeechFramesSlider = document.getElementById('minSpeechFrames');
    const minSpeechFramesValue = document.getElementById('minSpeechFrames-value');
    const positiveSpeechThresholdSlider = document.getElementById('positiveSpeechThreshold');
    const positiveSpeechThresholdValue = document.getElementById('positiveSpeechThreshold-value');
    const negativeSpeechThresholdSlider = document.getElementById('negativeSpeechThreshold');
    const negativeSpeechThresholdValue = document.getElementById('negativeSpeechThreshold-value');
    const preSpeechPadFramesSlider = document.getElementById('preSpeechPadFrames');
    const preSpeechPadFramesValue = document.getElementById('preSpeechPadFrames-value');

    // 언어 선택 요소
    const languageSelect = document.getElementById('language-select');

    // Web Audio API 컨텍스트
    let audioContext = null;
    let lastAudioBuffer = null;
    let lastRawAudio = null;
    let lastVoiceId = null; // 마지막으로 처리된 음성 ID 저장
    let lastRecognizedText = ''; // 마지막으로 인식된 텍스트

    // 음성 히스토리 관리
    let voiceHistory = [];

    // 권한 및 상태 관리
    let micPermissionGranted = false;
    let manualStop = false; // 수동으로 중지되었는지 여부를 추적하는 변수

    // Web Speech API 인식기 설정
    let speechRecognition = null;
    let isRecognitionSupported = false;
    let isRecognitionRunning = false;

    // 전역 변수로 인식기 관리 플래그 추가
    let isCreatingNewRecognizer = false;

    // Web Speech API 관련 변수
    let currentVoiceId = null; // 현재 처리 중인 음성 ID

    // 탭 전환 이벤트 설정
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 활성 탭 변경
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 활성 콘텐츠 변경
            const tabName = tab.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-history`).classList.add('active');

            // 서버 히스토리 탭이 선택되면 데이터 로드
            if (tabName === 'server') {
                loadServerHistory();
            }
        });
    });

    // 서버 히스토리 로드
    async function loadServerHistory() {
        if (!apiService.isServerAvailable) {
            serverVoiceHistoryContainer.innerHTML = '<p class="empty-history">서버 연결이 불가능합니다.</p>';
            return;
        }

        try {
            serverVoiceHistoryContainer.innerHTML = '<p class="empty-history">서버에서 데이터를 로드하는 중...</p>';

            // 서버에서 데이터 로드
            const audioList = await apiService.getAudioList();

            if (audioList.length === 0) {
                serverVoiceHistoryContainer.innerHTML = '<p class="empty-history">서버에 저장된 음성이 없습니다.</p>';
                return;
            }

            // 히스토리에 표시
            serverVoiceHistoryContainer.innerHTML = '';
            audioList.forEach(item => {
                const voiceItem = document.createElement('div');
                voiceItem.className = 'voice-item';

                // 날짜 포맷팅
                const date = new Date(item.timestamp || item.created);
                const dateStr = date.toLocaleString();

                voiceItem.innerHTML = `
                    <div class="voice-info">
                        <div class="voice-info-title">${dateStr}</div>
                        <div class="voice-info-details">파일명: ${item.filename}</div>
                        ${item.text ? `<div class="voice-text">${item.text}</div>` : ''}
                        <div class="server-item">
                            <a href="${item.url}" target="_blank" download="${item.filename}">다운로드</a>
                        </div>
                    </div>
                    <div class="voice-controls">
                        <button class="btn btn-small btn-play-small server-play-btn" data-url="${item.url}">▶</button>
                    </div>
                `;

                serverVoiceHistoryContainer.appendChild(voiceItem);

                // 재생 버튼 이벤트
                const playBtn = voiceItem.querySelector('.server-play-btn');
                playBtn.addEventListener('click', async () => {
                    const audioUrl = playBtn.getAttribute('data-url');
                    playServerAudio(audioUrl, playBtn);
                });
            });
        } catch (error) {
            console.error('서버 히스토리 로드 오류:', error);
            serverVoiceHistoryContainer.innerHTML = `<p class="empty-history">오류 발생: ${error.message}</p>`;
        }
    }

    // 서버에서 오디오 파일 재생
    async function playServerAudio(url, button) {
        try {
            // 다른 모든 재생 버튼 원래 상태로
            document.querySelectorAll('.server-play-btn').forEach(btn => {
                if (btn !== button) {
                    btn.textContent = '▶';
                }
            });

            // 재생 중인지 확인
            if (button.textContent === '■') {
                // 현재 재생 중 - 중지 기능은 추가적인 작업 필요
                return;
            }

            // 로딩 표시
            button.textContent = '...';

            // 오디오 컨텍스트 초기화
            if (!audioContext) {
                initAudioContext();
            }

            // 서버에서 오디오 파일 가져오기
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();

            // 오디오 디코딩
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // 오디오 소스 노드 생성
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // 오디오 출력에 연결
            source.connect(audioContext.destination);

            // 재생 상태 업데이트
            button.textContent = '■';

            // 재생 시작
            source.start(0);

            // 재생 완료 이벤트
            source.onended = () => {
                button.textContent = '▶';
            };
        } catch (error) {
            console.error('서버 오디오 재생 오류:', error);
            button.textContent = '▶';
        }
    }

    // 새로고침 버튼 이벤트
    refreshServerBtn.addEventListener('click', loadServerHistory);

    // 마이크 권한 요청 및 확인
    async function requestMicrophonePermission() {
        try {
            console.log("마이크 권한 요청 중...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 스트림 정리 (권한 확인 용도로만 사용)
            stream.getTracks().forEach(track => track.stop());

            micPermissionGranted = true;
            console.log("마이크 권한 획득 성공");
            return true;
        } catch (error) {
            console.error("마이크 권한 획득 실패:", error);
            micPermissionGranted = false;

            // 권한 오류 메시지 표시
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해야 합니다.");
            } else if (error.name === 'NotFoundError') {
                alert("마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.");
            } else {
                alert(`오류 발생: ${error.message}`);
            }

            return false;
        }
    }

    // 브라우저 환경 체크
    function checkBrowserEnvironment() {
        // 로컬 파일 프로토콜 체크
        if (window.location.protocol === 'file:') {
            console.warn("파일 프로토콜(file:)로 접근 중입니다. 보안 제한으로 인해 일부 기능이 작동하지 않을 수 있습니다.");
            console.warn("로컬 웹 서버를 사용하여 접근하시는 것을 권장합니다. (예: http-server, live-server 등)");

            const warning = document.createElement('div');
            warning.className = 'browser-warning';
            warning.innerHTML = `
                <p>⚠️ <strong>주의</strong>: 로컬 파일로 접근 중입니다. 보안 제한으로 인해 마이크 권한 및 음성 인식 기능이 제대로 작동하지 않을 수 있습니다.</p>
                <p>로컬 웹 서버를 사용하여 접근하시는 것을 권장합니다.</p>
                <code>npx http-server</code> 또는 <code>python -m http.server</code>를 사용하여 로컬 서버를 실행할 수 있습니다.
            `;
            document.querySelector('.card').prepend(warning);
        }

        // 브라우저 기능 지원 체크
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("이 브라우저는 MediaDevices API를 지원하지 않습니다.");
            return false;
        }

        return true;
    }

    // 오디오 컨텍스트 초기화
    function initAudioContext() {
        if (audioContext === null) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 16000 // VAD 모델은 16kHz 샘플레이트를 사용합니다
                });
            } catch (error) {
                console.error(`오디오 컨텍스트 초기화 오류: ${error.message}`);
            }
        }
    }

    // 오디오 버퍼 생성
    async function createAudioBuffer(audioData) {
        if (!audioContext) {
            initAudioContext();
        }

        try {
            // AudioBuffer 생성 (16kHz 모노 오디오)
            const buffer = audioContext.createBuffer(1, audioData.length, 16000);
            const channelData = buffer.getChannelData(0);

            // 오디오 데이터 복사
            for (let i = 0; i < audioData.length; i++) {
                channelData[i] = audioData[i];
            }

            return buffer;
        } catch (error) {
            console.error(`오디오 버퍼 생성 오류: ${error.message}`);
            return null;
        }
    }

    // 특정 음성 데이터 재생
    async function playVoice(audioData) {
        if (!audioContext) {
            initAudioContext();
        }

        try {
            // 오디오 버퍼 생성
            const buffer = await createAudioBuffer(audioData);

            if (!buffer) {
                throw new Error("오디오 버퍼 생성 실패");
            }

            // 오디오 소스 노드 생성
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            // 오디오 출력에 연결
            source.connect(audioContext.destination);

            // 재생 시작
            source.start(0);
            return source;
        } catch (error) {
            console.error(`오디오 재생 오류: ${error.message}`);
            return null;
        }
    }

    // 음성 히스토리 항목 추가
    function addVoiceHistoryItem(audioData, timestamp, displayText, customId = null, isError = false) {
        // 음성 데이터 저장
        const voiceId = customId || `voice-${Date.now()}`;
        const duration = (audioData.length / 16000).toFixed(2);

        // 서버에 저장 (설정에 따라)
        const saveToServer = saveToServerCheckbox.checked;
        if (saveToServer && apiService.isServerAvailable) {
            // 비동기적으로 서버에 저장
            apiService.saveAudio(audioData, displayText)
                .then(result => {
                    if (result) {
                        console.log('음성을 서버에 저장했습니다:', result);
                    }
                })
                .catch(error => {
                    console.error('서버 저장 실패:', error);
                });
        }

        // 히스토리 배열에 추가
        voiceHistory.unshift({
            id: voiceId,
            audio: audioData,
            timestamp: timestamp || new Date(),
            duration: duration,
            text: displayText || ""
        });

        // 마지막 음성 ID 저장
        lastVoiceId = voiceId;

        // 빈 히스토리 메시지 삭제
        const emptyMessage = voiceHistoryContainer.querySelector('.empty-history');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        // 히스토리 UI 업데이트
        const voiceItem = document.createElement('div');
        voiceItem.className = 'voice-item';
        voiceItem.id = voiceId;

        const time = new Date(timestamp || Date.now()).toLocaleTimeString();

        // 고유 클래스를 가진 텍스트 요소 생성
        const textClass = `voice-text voice-text-${voiceId}${isError ? ' error' : ''}`;
        const textAttribute = `data-voice-id="${voiceId}"`;

        voiceItem.innerHTML = `
            <div class="voice-info">
                <div class="voice-info-title">${time}</div>
                <div class="voice-info-details">길이: ${duration}초 / 샘플: ${audioData.length}</div>
                <div class="${textClass}" ${textAttribute}>${displayText}</div>
            </div>
            <div class="voice-controls">
                <button class="btn btn-small btn-play-small play-voice-btn">▶</button>
                <button class="btn btn-small btn-delete delete-voice-btn">🗑️</button>
            </div>
        `;

        // 히스토리 목록에 추가
        voiceHistoryContainer.prepend(voiceItem);

        // 재생 버튼 이벤트
        const playVoiceBtn = voiceItem.querySelector('.play-voice-btn');
        playVoiceBtn.addEventListener('click', async () => {
            // 다른 모든 재생 버튼 원래 상태로
            document.querySelectorAll('.play-voice-btn').forEach(btn => {
                if (btn !== playVoiceBtn) {
                    btn.textContent = '▶';
                }
            });

            // 재생 중인지 확인
            if (playVoiceBtn.textContent === '■') {
                // 현재 재생 중 - 중지 기능은 추가적인 작업 필요
                return;
            }

            // 재생 시작
            playVoiceBtn.textContent = '■';

            // 음성 데이터 찾기
            const voiceEntry = voiceHistory.find(entry => entry.id === voiceId);
            if (voiceEntry) {
                const source = await playVoice(voiceEntry.audio);

                if (source) {
                    // 재생 완료 이벤트
                    source.onended = () => {
                        playVoiceBtn.textContent = '▶';
                    };
                } else {
                    playVoiceBtn.textContent = '▶';
                }
            } else {
                playVoiceBtn.textContent = '▶';
            }
        });

        // 삭제 버튼 이벤트
        const deleteVoiceBtn = voiceItem.querySelector('.delete-voice-btn');
        deleteVoiceBtn.addEventListener('click', () => {
            // 배열에서 제거
            voiceHistory = voiceHistory.filter(entry => entry.id !== voiceId);

            // 삭제된 것이 마지막 ID와 일치하는 경우 초기화
            if (lastVoiceId === voiceId) {
                lastVoiceId = voiceHistory.length > 0 ? voiceHistory[0].id : null;
            }

            // UI에서 제거
            voiceItem.remove();

            // 비어있는 경우 메시지 표시
            if (voiceHistory.length === 0) {
                voiceHistoryContainer.innerHTML = '<p class="empty-history">아직 감지된 음성이 없습니다.</p>';
                clearHistoryBtn.disabled = true;
            }
        });

        // 히스토리 비우기 버튼 활성화
        clearHistoryBtn.disabled = false;

        return voiceId; // ID 반환 추가
    }

    // 히스토리 비우기 버튼 이벤트
    clearHistoryBtn.addEventListener('click', () => {
        // 배열 비우기
        voiceHistory = [];
        lastVoiceId = null;

        // UI 비우기
        voiceHistoryContainer.innerHTML = '<p class="empty-history">아직 감지된 음성이 없습니다.</p>';

        // 버튼 비활성화
        clearHistoryBtn.disabled = true;
    });

    // 모달 관련 이벤트 리스너
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // 저장 버튼 클릭 시 VAD 옵션 업데이트
    saveSettingsBtn.addEventListener('click', async () => {
        await updateVadOptions();
        settingsModal.style.display = 'none';
    });

    // 슬라이더 이벤트 리스너 설정 - 원래 위치에서 제거
    function setupSliderListeners() {
        thresholdSlider.addEventListener('input', () => {
            thresholdValue.textContent = thresholdSlider.value;
        });

        minSpeechFramesSlider.addEventListener('input', () => {
            minSpeechFramesValue.textContent = minSpeechFramesSlider.value;
        });

        positiveSpeechThresholdSlider.addEventListener('input', () => {
            positiveSpeechThresholdValue.textContent = positiveSpeechThresholdSlider.value;
        });

        negativeSpeechThresholdSlider.addEventListener('input', () => {
            negativeSpeechThresholdValue.textContent = negativeSpeechThresholdSlider.value;
        });

        preSpeechPadFramesSlider.addEventListener('input', () => {
            preSpeechPadFramesValue.textContent = preSpeechPadFramesSlider.value;
        });
    }

    // VAD 옵션 초기 설정
    let vadOptions = {
        threshold: parseFloat(thresholdSlider.value),
        minSpeechFrames: parseInt(minSpeechFramesSlider.value),
        positiveSpeechThreshold: parseFloat(positiveSpeechThresholdSlider.value),
        negativeSpeechThreshold: parseFloat(negativeSpeechThresholdSlider.value),
        preSpeechPadFrames: parseInt(preSpeechPadFramesSlider.value),

        onSpeechStart() {
            updateUIState('speaking');

            // 새 음성 세션 시작 시 ID 생성
            currentVoiceId = `voice-${Date.now()}`;
            console.log('새 음성 세션 시작:', currentVoiceId);

            // 음성 인식 시작
            initAndStartSpeechRecognition();
        },
        async onSpeechEnd(audio) {
            updateUIState('listening');

            // 오디오 데이터 저장
            lastRawAudio = audio;

            // 음성 인식 중지 (결과 확정을 위해)
            stopSpeechRecognition();

            // 결과 처리 시간 확보
            await new Promise(resolve => setTimeout(resolve, 300));

            // 인식 결과 확인 및 처리
            const recognitionText = lastRecognizedText || "";
            const isError = !recognitionText;
            const displayText = isError ? "인식 실패" : recognitionText;

            // 히스토리에 추가 (인식된 텍스트와 함께)
            addVoiceHistoryItem(audio, new Date(), displayText, currentVoiceId, isError);

            // 서버에 저장
            if (apiService.isServerAvailable && saveToServerCheckbox.checked) {
                try {
                    await apiService.saveAudio(audio, displayText);
                    console.log('음성과 텍스트를 서버에 저장했습니다');
                } catch (error) {
                    console.error('서버 저장 실패:', error);
                }
            }

            // 다음 인식을 위해 텍스트 초기화
            lastRecognizedText = '';
        },
        onVADMisfire() {
            console.log('VAD 오탐지 발생');
        }
    };

    // VAD 인스턴스 저장 변수
    let myvad = null;

    // VAD 옵션 업데이트 함수
    async function updateVadOptions() {
        // 새 옵션 생성
        const newOptions = {
            threshold: parseFloat(thresholdSlider.value),
            minSpeechFrames: parseInt(minSpeechFramesSlider.value),
            positiveSpeechThreshold: parseFloat(positiveSpeechThresholdSlider.value),
            negativeSpeechThreshold: parseFloat(negativeSpeechThresholdSlider.value),
            preSpeechPadFrames: parseInt(preSpeechPadFramesSlider.value)
        };

        // 변경사항 로그 출력
        console.log("VAD 설정 업데이트:", newOptions);

        // 현재 VAD 실행 상태 저장
        const isRunning = myvad !== null;

        // 새 옵션으로 VAD 업데이트 (객체 복사 방식 사용)
        Object.assign(vadOptions, newOptions);

        // 현재 실행 중인 경우 메시지 표시
        if (isRunning) {
            console.log("VAD 설정이 업데이트되었습니다. 다음 음성 감지부터 적용됩니다.");

            // 사용자에게 알림 (선택 사항)
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = '설정이 변경되었습니다. 중지 후 다시 시작하면 적용됩니다.';
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            notification.style.color = 'white';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '1000';
            document.body.appendChild(notification);

            // 3초 후 알림 제거
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        } else {
            console.log("VAD 설정이 업데이트되었습니다. VAD 시작 시 적용됩니다.");
        }
    }

    // 서버 상태 확인 함수
    async function checkServerStatus() {
        try {
            // apiService가 존재하는지 확인
            if (typeof apiService !== 'undefined') {
                // 이미 초기화되어 있으면 다시 확인하지 않음
                if (apiService.isServerAvailable !== undefined) {
                    return;
                }

                // 서버 상태 확인
                await apiService.checkServer();

                // 서버 상태 표시 업데이트
                const serverIndicator = document.getElementById('server-indicator');
                const serverStatusText = document.getElementById('server-status-text');

                if (apiService.isServerAvailable) {
                    serverIndicator.classList.remove('checking');
                    serverIndicator.classList.add('online');
                    serverStatusText.textContent = '서버 연결됨';
                } else {
                    serverIndicator.classList.remove('checking');
                    serverIndicator.classList.add('offline');
                    serverStatusText.textContent = '서버 연결 실패. 로컬 모드로 실행 중';
                }
            } else {
                console.error('apiService가 정의되지 않았습니다.');
            }
        } catch (error) {
            console.error('서버 상태 확인 중 오류 발생:', error);
        }
    }

    // 초기화 함수
    function initialize() {
        // 브라우저 환경 확인
        checkBrowserEnvironment();

        // vad 객체 확인
        if (!window.vad) {
            console.error('VAD 라이브러리가 로드되지 않았습니다. 페이지를 새로고침하거나 브라우저를 확인해주세요.');
            alert('음성 감지 라이브러리(VAD)가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
            return;
        }

        // 슬라이더 이벤트 리스너 설정
        setupSliderListeners();

        // 서버 상태 확인
        checkServerStatus();

        // 시작 버튼 이벤트 리스너
        startBtn.addEventListener('click', async () => {
            // 수동 중지 플래그 초기화
            manualStop = false;

            // 마이크 권한 확인
            if (!micPermissionGranted) {
                const permissionGranted = await requestMicrophonePermission();
                if (!permissionGranted) {
                    return;
                }
            }

            // UI 상태 업데이트
            updateUIState('listening');

            // VAD 시작
            startVAD();
        });

        // 중지 버튼 이벤트 리스너
        stopBtn.addEventListener('click', () => {
            console.log('중지 버튼 클릭됨');
            manualStop = true; // 수동 중지 플래그 설정

            // VAD 중지
            stopVAD();

            // 음성 인식 중지
            stopSpeechRecognition();

            // UI 상태 명시적 업데이트
            updateUIState('stopped');
        });

        // 언어 선택 이벤트 리스너
        languageSelect.addEventListener('change', () => {
            console.log(`언어 변경됨: ${languageSelect.value}`);
            
            // 현재 실행 중인 경우 알림 표시
            if (isRecognitionRunning) {
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.textContent = '언어 설정이 변경되었습니다. 중지 후 다시 시작하면 적용됩니다.';
                notification.style.position = 'fixed';
                notification.style.bottom = '20px';
                notification.style.right = '20px';
                notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                notification.style.color = 'white';
                notification.style.padding = '10px 15px';
                notification.style.borderRadius = '5px';
                notification.style.zIndex = '1000';
                document.body.appendChild(notification);

                // 3초 후 알림 제거
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.5s';
                    setTimeout(() => notification.remove(), 500);
                }, 3000);
            }
        });
    }

    // 페이지 로드 시 초기화 함수 호출
    initialize();

    // VAD 중지 함수
    async function stopVAD() {
        if (myvad) {
            try {
                // VAD 중지 - 객체의 메서드 확인
                console.log('myvad 객체:', myvad);

                // 다양한 중지 메서드 시도
                if (typeof myvad.stop === 'function') {
                    await myvad.stop();
                } else if (typeof myvad.destroy === 'function') {
                    await myvad.destroy();
                } else if (typeof myvad.close === 'function') {
                    await myvad.close();
                } else if (typeof myvad.pause === 'function') {
                    await myvad.pause();
                } else {
                    // 메서드가 없는 경우 객체 참조만 제거
                    console.warn('VAD 객체에 중지 메서드가 없습니다.');
                }

                // 객체 참조 제거
                myvad = null;

                // UI 업데이트 - 중앙 함수 사용
                updateUIState('stopped');

                console.log('음성 감지 중지됨');
            } catch (error) {
                console.error('VAD 중지 중 오류 발생:', error);
                // 오류가 발생해도 UI는 업데이트
                updateUIState('stopped');
            }
        } else {
            console.log('중지할 VAD 세션이 없습니다.');
            // VAD가 없어도 UI는 업데이트
            updateUIState('stopped');
        }
    }

    // VAD 시작 함수
    async function startVAD() {
        try {
            // 브라우저 환경 체크
            if (!checkBrowserEnvironment()) {
                alert("현재 브라우저 환경에서는 기능이 제한될 수 있습니다.");
                return;
            }

            // 오디오 컨텍스트 초기화
            initAudioContext();

            // VAD 초기화
            myvad = await vad.MicVAD.new(vadOptions);

            // VAD 시작
            await myvad.start();

            console.log('음성 감지 시작됨');
        } catch (error) {
            // 권한 오류 처리
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해야 합니다.");
                micPermissionGranted = false;
            } else {
                alert(`오류 발생: ${error.message}`);
                console.error(`오류 발생: ${error.message}`);
            }

            // 오류 발생 시 UI 복원
            updateUIState('stopped');
        }
    }

    // 음성 인식 초기화 및 시작 함수
    function initAndStartSpeechRecognition() {
        console.log('음성 인식 초기화 시작');

        // 이미 실행 중이면 중복 실행 방지
        if (isRecognitionRunning) {
            console.log("음성 인식이 이미 실행 중입니다.");
            return;
        }

        try {
            // 브라우저 지원 확인
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.error('이 브라우저는 Speech Recognition을 지원하지 않습니다.');
                return;
            }

            // 이전 인식기 정리
            if (speechRecognition) {
                try {
                    speechRecognition.abort();
                    console.log('이전 인식기 정리됨');
                } catch (e) {
                    console.log("이전 인식기 정리 오류:", e);
                }
            }

            // 새 인식기 생성
            speechRecognition = new SpeechRecognition();
            console.log('새 인식기 생성됨:', speechRecognition);

            // 선택된 언어 설정
            const selectedLanguage = languageSelect.value;
            speechRecognition.lang = selectedLanguage;
            console.log(`음성 인식 언어 설정: ${selectedLanguage}`);
            
            // 나머지 설정
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;

            // 인식 결과 이벤트
            speechRecognition.onresult = (event) => {
                if (event.results.length > 0) {
                    const result = event.results[0];
                    const isFinal = result.isFinal;
                    const transcript = result[0].transcript;

                    console.log(`인식 결과: "${transcript}", 최종: ${isFinal}`);
                    lastRecognizedText = transcript;

                    // 현재 활성화된 음성 항목 업데이트
                    // if (currentVoiceId) {
                    //     updateVoiceItemText(currentVoiceId, transcript, isFinal);
                    // }
                }
            };

            // 시작 이벤트
            speechRecognition.onstart = () => {
                console.log('음성 인식 시작됨');
                isRecognitionRunning = true;
            };

            // 종료 이벤트
            speechRecognition.onend = () => {
                console.log('음성 인식 종료됨');
                isRecognitionRunning = false;
            };

            // 오류 이벤트
            speechRecognition.onerror = (event) => {
                console.error('음성 인식 오류:', event.error);
                isRecognitionRunning = false;
            };

            // 인식 시작
            speechRecognition.start();
            console.log('Web Speech API 인식 시작 요청됨');

        } catch (error) {
            console.error('Speech Recognition 시작 오류:', error);
            isRecognitionRunning = false;
            speechRecognition = null;
        }
    }

    // 음성 항목 텍스트 업데이트 함수
    function updateVoiceItemText(voiceId, text, isFinal) {
        if (!voiceId) {
            console.error('음성 ID가 없습니다.');
            return;
        }

        const voiceItem = document.getElementById(voiceId);
        if (!voiceItem) {
            console.error('음성 항목을 찾을 수 없음:', voiceId);
            return;
        }

        // 텍스트 요소 찾기 또는 생성
        let textElement = voiceItem.querySelector('.voice-text');
        if (!textElement) {
            textElement = document.createElement('div');
            textElement.className = 'voice-text';
            textElement.setAttribute('data-voice-id', voiceId);
            voiceItem.querySelector('.voice-info').appendChild(textElement);
            console.log('새 텍스트 요소 생성됨:', voiceId);
        }

        // 텍스트 업데이트
        textElement.textContent = text;

        // 중간/최종 결과 스타일 적용
        if (!isFinal) {
            textElement.classList.add('interim'); // 주황색
        } else {
            textElement.classList.remove('interim'); // 파란색

            // 히스토리 배열 업데이트
            const voiceIndex = voiceHistory.findIndex(entry => entry.id === voiceId);
            if (voiceIndex !== -1) {
                voiceHistory[voiceIndex].text = text;
                console.log('히스토리 배열 업데이트됨:', voiceIndex);

                // 서버에 텍스트 업데이트 (최종 결과만)
                if (apiService.isServerAvailable && saveToServerCheckbox.checked) {
                    const voiceEntry = voiceHistory[voiceIndex];
                    apiService.saveAudio(voiceEntry.audio, text)
                        .then(result => {
                            if (result) {
                                console.log('음성 텍스트를 서버에 업데이트했습니다:', result);
                            }
                        })
                        .catch(error => {
                            console.error('서버 업데이트 실패:', error);
                        });
                }
            }
        }
    }

    // 인식기 완전 재설정 함수
    async function resetRecognizer() {
        console.log('인식기 완전 재설정 시작');

        // 이전 인식기 정리
        if (speechRecognition) {
            try {
                // 이벤트 핸들러 제거
                speechRecognition.onresult = null;
                speechRecognition.onstart = null;
                speechRecognition.onend = null;
                speechRecognition.onerror = null;

                // 실행 중이면 중지
                if (isRecognitionRunning) {
                    speechRecognition.abort();
                    isRecognitionRunning = false;
                    // 약간의 지연 추가
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (e) {
                console.log("이전 인식기 정리 오류:", e);
            }
        }

        // 변수 초기화
        speechRecognition = null;
        isRecognitionRunning = false;
        lastRecognizedText = '';

        console.log('인식기 완전 재설정 완료');
    }

    // 음성 인식 중지 함수
    function stopSpeechRecognition() {
        console.log('음성 인식 상태:', {
            speechRecognition: speechRecognition ? '존재함' : '없음',
            isRunning: isRecognitionRunning
        });

        // 인식기가 없어도 상태 변수는 초기화
        if (isRecognitionRunning) {
            isRecognitionRunning = false;
        }

        if (speechRecognition) {
            try {
                speechRecognition.stop();
                console.log('음성 인식 중지됨');
            } catch (error) {
                console.error('음성 인식 중지 오류:', error);

                try {
                    speechRecognition.abort();
                    console.log('음성 인식 강제 종료됨');
                } catch (abortError) {
                    console.error('음성 인식 강제 종료 오류:', abortError);
                }
            }
        } else {
            console.log('중지할 음성 인식 세션이 없습니다.');
        }
    }

    // UI 상태 업데이트 함수 추가
    function updateUIState(state) {
        console.log('UI 상태 업데이트:', state);

        switch (state) {
            case 'listening':
                // 듣는 중 상태
                statusIndicator.classList.remove('speaking');
                statusIndicator.classList.remove('error');
                statusIndicator.classList.add('listening');
                statusText.textContent = '듣는 중...';

                // 버튼 상태 업데이트
                startBtn.disabled = true;
                stopBtn.disabled = false;
                break;

            case 'speaking':
                // 말하는 중 상태
                statusIndicator.classList.remove('listening');
                statusIndicator.classList.remove('error');
                statusIndicator.classList.add('speaking');
                statusText.textContent = '음성 감지됨!';

                // 버튼 상태 유지
                startBtn.disabled = true;
                stopBtn.disabled = false;
                break;

            case 'stopped':
                // 중지 상태
                statusIndicator.classList.remove('listening');
                statusIndicator.classList.remove('speaking');
                statusIndicator.classList.remove('error');
                statusText.textContent = '대기 중';

                // 버튼 상태 업데이트
                startBtn.disabled = false;
                stopBtn.disabled = true;
                break;

            case 'error':
                // 오류 상태
                statusIndicator.classList.remove('listening');
                statusIndicator.classList.remove('speaking');
                statusIndicator.classList.add('error');
                statusText.textContent = '오류 발생';

                // 버튼 상태 업데이트
                startBtn.disabled = false;
                stopBtn.disabled = true;
                break;
        }
    }
});
