# youtube_router.py
# ─────────────────────────────────────────────────────────────
# 유튜브 URL을 받아 영상 다운로드(YT) → *_fixed.mp4(AVG) → MP3(MP3)
# 원본 mp4는 삭제하고 fixed.mp4만 유지.
# STT는 2세션에서 /stt-stream으로 수행.
# ─────────────────────────────────────────────────────────────
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import os, re
from settings import YT_DIR, AVG_DIR, MP3_DIR
from media_utils import reencode_audio_mp4, extract_mp3_with_ffmpeg

router = APIRouter()

def sanitize(name: str) -> str:
    """파일명 내 특수문자 제거"""
    return re.sub(r"[^\w\-.]", "_", name)

@router.get("/youtube-process")
def process_youtube(url: str = Query(..., description="YouTube URL")):
    try:
        import yt_dlp
        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'outtmpl': os.path.join(YT_DIR, '%(title)s.%(ext)s'),
            'merge_output_format': 'mp4'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            downloaded = ydl.prepare_filename(info)   # YT/제목.mp4
    except Exception as e:
        return JSONResponse({"error": f"YouTube 다운로드 실패: {e}"}, status_code=500)

    # AVG로 이동
    filename = os.path.basename(downloaded)
    name_only = sanitize(os.path.splitext(filename)[0])
    avg_mp4 = os.path.join(AVG_DIR, f"{name_only}.mp4")
    if not os.path.exists(avg_mp4):
        os.replace(downloaded, avg_mp4)

    # 재인코딩 및 MP3 추출
    fixed_path = reencode_audio_mp4(avg_mp4)

    # 원본 mp4 삭제 (fixed는 유지)
    try:
        if os.path.exists(avg_mp4) and avg_mp4 != fixed_path:
            os.remove(avg_mp4)
    except OSError:
        pass

    base = os.path.splitext(os.path.basename(fixed_path))[0]
    mp3_path = os.path.join(MP3_DIR, f"{base}.mp3")
    extract_mp3_with_ffmpeg(fixed_path, mp3_path)

    return {
        "message": "🎧 MP3 변환 완료. STT는 2세션에서 진행하세요.",
        "mp3_file": os.path.basename(mp3_path),
        "filename": os.path.basename(mp3_path)
    }
