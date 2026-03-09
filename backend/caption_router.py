# caption_router.py
# ─────────────────────────────────────────────────────────────
# 언어별 SRT/VTT 제공
# - 번역(lang 제공)  : TRANS/srt/[base]_fixed_[lang].srt
# - 번역 없음(lang X): STT/srt/[base]_fixed.srt (원문)
# ─────────────────────────────────────────────────────────────
from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse
import os
from settings import STT_SRT_DIR, TRANS_SRT_DIR  # ✅ STT_DIR → STT_SRT_DIR

router = APIRouter()

def norm_lang(lang: str | None) -> str | None:
    if not lang:
        return None
    lang = lang.lower()
    return {"jp": "ja", "kr": "ko"}.get(lang, lang)

def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def stem(filename: str) -> str:
    # 예: "쇼핑몰_fixed.mp3" → "쇼핑몰_fixed"  (_fixed 유지)
    return os.path.splitext(filename)[0]

def find_srt(base: str, lang: str | None) -> str | None:
    cands = []
    if lang:
        # 번역본 우선: [base]_fixed_[lang].srt
        cands += [
            os.path.join(TRANS_SRT_DIR, f"{base}_{lang}.srt"),
            os.path.join(TRANS_SRT_DIR, f"{base}_{lang}.SRT"),
        ]
    # 원문: [base]_fixed.srt
    cands += [
        os.path.join(STT_SRT_DIR, f"{base}.srt"),
        os.path.join(STT_SRT_DIR, f"{base}.SRT"),
    ]
    for p in cands:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return p
    return None

@router.get("/stt-srt")
def get_srt(
    filename: str = Query(..., description="MP3 파일명 (예: xxx_fixed.mp3)"),
    lang: str | None = Query(None, description="자막 언어 (예: en/ja)"),
):
    """
    번역(lang) 있으면 TRANS/srt/[base]_fixed_[lang].srt,
    없으면 STT/srt/[base]_fixed.srt 를 반환.
    """
    base = stem(filename)          # xxx_fixed.mp3 → xxx_fixed
    lang = norm_lang(lang)         # 기본 ko 제거, 전달된 경우만 정규화
    srt_path = find_srt(base, lang)
    if not srt_path:
        return PlainTextResponse("SRT 파일이 아직 생성되지 않았습니다.", status_code=404)
    return PlainTextResponse(read_text(srt_path), media_type="text/plain")

@router.get("/stt-vtt")
def get_vtt(
    filename: str = Query(..., description="MP3 파일명 (예: xxx_fixed.mp3)"),
    lang: str | None = Query(None, description="자막 언어 (예: en/ja)"),
):
    """
    위 규칙으로 SRT를 찾고 VTT로 변환해 반환.
    """
    base = stem(filename)          # xxx_fixed.mp3 → xxx_fixed
    lang = norm_lang(lang)
    srt_path = find_srt(base, lang)
    if not srt_path:
        return PlainTextResponse("SRT 파일이 아직 생성되지 않았습니다.", status_code=404)

    # SRT → VTT (간단 변환: 숫자 인덱스 라인 제거 + , → .)
    srt = read_text(srt_path)
    lines = [ln for ln in srt.splitlines() if not ln.strip().isdigit()]
    vtt = "WEBVTT\n\n" + "\n".join(lines).replace(",", ".")
    return PlainTextResponse(vtt, media_type="text/vtt")