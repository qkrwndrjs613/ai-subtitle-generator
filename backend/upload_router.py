# upload_router.py
# ─────────────────────────────────────────────────────────────
# 파일 업로드 → MP4 저장(AVG) → *_fixed.mp4 재인코딩 → MP3 추출(MP3)
# 원본 mp4는 삭제하고 fixed.mp4만 유지.
# 프론트는 반환된 mp3 파일명을 가지고 2세션에서 /stt-stream을 호출한다.
# ─────────────────────────────────────────────────────────────
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
import os, shutil
from settings import AVG_DIR, MP3_DIR
from media_utils import reencode_audio_mp4, extract_mp3_with_ffmpeg

router = APIRouter()

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    1) 원본 MP4를 AVG_DIR에 저장
    2) *_fixed.mp4로 오디오 재인코딩 (AAC)
    3) 원본 .mp4 삭제
    4) MP3_DIR에 mp3 추출
    5) mp3 파일명 반환 (프론트가 /stt-stream에 사용)
    """
    try:
        # 1) 원본 저장
        raw_path = os.path.join(AVG_DIR, file.filename)
        with open(raw_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2) 오디오 재인코딩 (호환성 위해)
        fixed_path = reencode_audio_mp4(raw_path)

        # 3) 원본 mp4 삭제 (fixed는 유지)
        try:
            if os.path.exists(raw_path) and raw_path != fixed_path:
                os.remove(raw_path)
        except OSError:
            pass  # 삭제 실패해도 무시

        # 4) MP3 추출
        base = os.path.splitext(os.path.basename(fixed_path))[0]
        mp3_path = os.path.join(MP3_DIR, f"{base}.mp3")
        extract_mp3_with_ffmpeg(fixed_path, mp3_path)

        return {
            "message": f"{file.filename} 업로드 완료",
            "filename": os.path.basename(mp3_path),   # 프론트 Step2에서 사용
            "video_path": os.path.basename(fixed_path)
        }
    except Exception as e:
        return JSONResponse({"error": f"업로드 실패: {e}"}, status_code=500)
