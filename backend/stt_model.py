# stt_model.py
# faster-whisper 모델을 로드합니다.
# - 로드가 매우 무거우므로 앱 시작 시 1회만 생성하여 재사용.

from faster_whisper import WhisperModel

model = WhisperModel(
    "large-v3",
    device="cuda",
    compute_type="float16",
    local_files_only=True)