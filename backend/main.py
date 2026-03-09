# main.py
# ─────────────────────────────────────────────────────────────
# FastAPI 엔트리포인트
# - CORS 정책
# - 정적 폴더 마운트
# - 라우터 등록
# - 헬스체크/디버그 엔드포인트
# ─────────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from settings import AVG_DIR, MP3_DIR, STT_DIR
from settings import STT_TXT_DIR, STT_SRT_DIR   

# ── 라우터 임포트
from upload_router import router as upload_router        # /upload
from youtube_router import router as youtube_router      # /youtube-process
from stt_router import router as stt_router              # /stt-stream (SSE)
from translate_router import router as translate_router  # /translate-text, /srt-translate
from caption_router import router as caption_router      # /stt-srt, /stt-vtt

app = FastAPI(title="STT Project API (Refactored)")

# ── CORS (필요 시 도메인 제한)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 정적 서빙
app.mount("/uploads", StaticFiles(directory=AVG_DIR), name="uploads")  # 영상(mp4)
app.mount("/static", StaticFiles(directory=MP3_DIR), name="static")    # 오디오(mp3)
app.mount("/stt", StaticFiles(directory=STT_DIR), name="stt")          # 원문(STT)

# ── 라우터 등록
app.include_router(upload_router)
app.include_router(youtube_router)
app.include_router(stt_router)
app.include_router(translate_router)
app.include_router(caption_router)

# ── 헬스체크
@app.get("/")
def root():
    return {"ok": True, "message": "FastAPI is running."}

# ── 디버그: STT 디렉토리 목록 (하위 txt/srt 포함)
@app.get("/debug-stt")
def debug_stt():
    import os, glob
    files_txt = sorted(glob.glob(os.path.join(STT_TXT_DIR, "*.*")))
    files_srt = sorted(glob.glob(os.path.join(STT_SRT_DIR, "*.*")))
    return {
        "STT_TXT_DIR": STT_TXT_DIR,
        "STT_SRT_DIR": STT_SRT_DIR,
        "txt_files": [os.path.basename(f) for f in files_txt],
        "srt_files": [os.path.basename(f) for f in files_srt],
    }
