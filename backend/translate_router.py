# translate_router.py
# ─────────────────────────────────────────────────────────────
# 2단계 비동기 번역:
#  - 1) /translate-text-file : STT/TXT 를 번역해 TRANS/TXT 저장 + 번역문 즉시 응답
#       (옵션) 바로 SRT 백그라운드 번역 시작
#  - 2) /translate-srt-status : SRT 백그라운드 번역 상태 폴링(pending/running/done/error)
# 보조:
#  - /srt-translate : SRT만 동기 번역 (필요 시 유지)
#  - /translate-text : 화면 텍스트 즉시 번역(저장X)
# 원문: STT_TXT_DIR / STT_SRT_DIR
# 저장: TRANS_TXT_DIR / TRANS_SRT_DIR
# 안정성: Google 실패 시 MyMemory 폴백
# ─────────────────────────────────────────────────────────────

from fastapi import APIRouter, Body, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os, re, threading

from deep_translator import GoogleTranslator, MyMemoryTranslator
from settings import (
    STT_TXT_DIR, STT_SRT_DIR,
    TRANS_TXT_DIR, TRANS_SRT_DIR,
)

router = APIRouter()

# ── 언어 코드 표준화
LANG_MAP = {"jp": "ja", "kr": "ko", "cn": "zh-cn", "tw": "zh-tw"}
def norm_lang(lang: str) -> str:
    if not lang:
        return "en"
    lang = lang.strip().lower()
    return LANG_MAP.get(lang, lang)

# ── 파일명에서 base 추출
def base_name(name: str) -> str:
    if not name:
        return ""
    for ext in (".mp3", ".srt", ".txt", ".wav", ".m4a", ".SRT", ".TXT"):
        if name.endswith(ext):
            return name[: -len(ext)]
    return name

# ── 긴 텍스트 분할
def split_text(text: str, max_len: int = 2000):
    text = text or ""
    if len(text) <= max_len:
        return [text]
    chunks, start = [], 0
    while start < len(text):
        end = min(start + max_len, len(text))
        cut = end
        for sep in [". ", "? ", "! ", "\n\n", "\n"]:
            idx = text.rfind(sep, start, end)
            if idx != -1 and idx > start + 50:
                cut = idx + len(sep)
                break
        chunks.append(text[start:cut].strip())
        start = cut
    return [c for c in chunks if c]

# ── 안전 번역 (Google → 실패 시 MyMemory)
def safe_translate_chunk(chunk: str, target: str) -> str:
    chunk = chunk or ""
    if not chunk.strip():
        return ""
    try:
        return GoogleTranslator(source="auto", target=target).translate(chunk)
    except Exception:
        pass
    try:
        return MyMemoryTranslator(source="auto", target=target).translate(chunk)
    except Exception:
        return chunk  # 최후에는 원문 유지(UX 보호)

def translate_long_text(text: str, target_lang: str) -> str:
    parts = []
    for c in split_text(text):
        parts.append(safe_translate_chunk(c, target_lang))
    return " ".join([p for p in parts if p]).strip()

# ── SRT 파서/포매터
SRT_BLOCK_RE = re.compile(
    r"(\d+)\s*\r?\n([0-9:\.,\-\>\s]+)\r?\n([\s\S]*?)(?=\r?\n\r?\n|\Z)",
    re.MULTILINE,
)

def parse_srt_blocks(srt_text: str):
    blocks = []
    for m in SRT_BLOCK_RE.finditer(srt_text or ""):
        idx = m.group(1).strip()
        ts = m.group(2).strip()
        body = (m.group(3) or "").strip()
        blocks.append((idx, ts, body))
    return blocks

def format_srt_blocks(blocks):
    out = []
    for i, (_idx, ts, body) in enumerate(blocks, start=1):
        out.append(f"{i}")
        out.append(ts)
        out.append(body)
        out.append("")
    return "\n".join(out).strip() + "\n"

def translate_srt_text(srt_text: str, target: str) -> str:
    blocks = parse_srt_blocks(srt_text)
    tl = []
    for idx, ts, body in blocks:
        lines = [ln.strip() for ln in (body.splitlines() if body else [])]
        if lines:
            tl_lines = [safe_translate_chunk(ln, target) for ln in lines]
            tl_body = "\n".join(tl_lines).strip()
        else:
            tl_body = ""
        tl.append((idx, ts, tl_body))
    return format_srt_blocks(tl)

# ── 상태 관리(간단 인메모리)
SRT_STATUS = {}
SRT_STATUS_LOCK = threading.Lock()

def _set_status(key: str, value: str):
    with SRT_STATUS_LOCK:
        SRT_STATUS[key] = value

def _get_status(key: str) -> str:
    with SRT_STATUS_LOCK:
        return SRT_STATUS.get(key, "none")

# ── 백그라운드 SRT 번역 작업
def _translate_srt_and_save(base: str, lang: str):
    key = f"{base}_{lang}"
    try:
        _set_status(key, "running")

        src_srt = os.path.join(STT_SRT_DIR, f"{base}.SRT")
        if not os.path.exists(src_srt):
            _set_status(key, "error")
            return

        with open(src_srt, "r", encoding="utf-8") as f:
            original_srt = f.read()

        tl_srt = translate_srt_text(original_srt, lang)

        os.makedirs(TRANS_SRT_DIR, exist_ok=True)
        out = os.path.join(TRANS_SRT_DIR, f"{base}_{lang}.SRT")
        with open(out, "w", encoding="utf-8") as g:
            g.write(tl_srt)

        _set_status(key, "done")
    except Exception:
        _set_status(key, "error")

# ── 요청/응답 모델
class TranslateTextFileReq(BaseModel):
    filename: str
    target_lang: str
    start_srt: bool = True

class TranslateSrtRequest(BaseModel):
    filename: str
    target_lang: str

class TranslateTextRequest(BaseModel):
    text: str
    target_lang: str

# ── (A) 화면 텍스트 즉시 번역(저장X)
@router.post("/translate-text")
def translate_text_api(data: TranslateTextRequest = Body(...)):
    try:
        lang = norm_lang(data.target_lang)
        translated = translate_long_text(data.text or "", lang)
        return {"ok": True, "text": translated, "lang": lang}
    except Exception as e:
        return {"ok": False, "error": f"translate-text failed: {e}"}

# ── (B) TXT 파일 번역 후 저장 + (옵션) SRT 백그라운드 시작
@router.post("/translate-text-file")
def translate_text_file_api(data: TranslateTextFileReq = Body(...), background: BackgroundTasks = None):
    try:
        lang = norm_lang(data.target_lang)
        b = base_name(data.filename)
        if not b:
            return {"ok": False, "error": "filename 누락 또는 해석 실패"}

        # TXT 번역
        src_txt = os.path.join(STT_TXT_DIR, f"{b}.TXT")
        if not os.path.exists(src_txt):
            return {"ok": False, "error": f"원문 TXT 없음: {src_txt}"}

        with open(src_txt, "r", encoding="utf-8") as f:
            original_txt = f.read()

        translated_txt = translate_long_text(original_txt, lang)

        os.makedirs(TRANS_TXT_DIR, exist_ok=True)
        out_txt = os.path.join(TRANS_TXT_DIR, f"{b}_{lang}.TXT")
        with open(out_txt, "w", encoding="utf-8") as g:
            g.write(translated_txt)

        # SRT 백그라운드 시작
        srt_key = f"{b}_{lang}"
        if data.start_srt:
            _set_status(srt_key, "pending")
            if background is not None:
                background.add_task(_translate_srt_and_save, b, lang)
            else:
                threading.Thread(target=_translate_srt_and_save, args=(b, lang), daemon=True).start()
        else:
            _set_status(srt_key, "none")

        return {
            "ok": True,
            "message": f"TXT 번역 성공 ({lang})",
            "txt_file": f"{b}_{lang}.TXT",
            "txt_text": translated_txt,
            "srt_status": _get_status(srt_key),
            "lang": lang,
        }
    except Exception as e:
        return {"ok": False, "error": f"translate-text-file failed: {e}"}

# ── (C) SRT 번역 상태 폴링
@router.get("/translate-srt-status")
def translate_srt_status(
    filename: str = Query(...),
    target_lang: str = Query(...),
):
    b = base_name(filename)
    lang = norm_lang(target_lang)
    key = f"{b}_{lang}"
    status = _get_status(key)

    srt_file = None
    if status == "done":
        srt_file = f"{b}_{lang}.SRT"
        out = os.path.join(TRANS_SRT_DIR, srt_file)
        if not os.path.exists(out):
            status = "error"
            srt_file = None

    return {"ok": True, "status": status, "srt_file": srt_file, "lang": lang}

# ── (D) SRT만 동기 번역
@router.post("/srt-translate")
def srt_translate_api(data: TranslateSrtRequest = Body(...)):
    try:
        lang = norm_lang(data.target_lang)
        b = base_name(data.filename)

        src_srt = os.path.join(STT_SRT_DIR, f"{b}.SRT")
        if not os.path.exists(src_srt):
            return JSONResponse({"ok": False, "error": f"SRT not found: {src_srt}"}, status_code=404)

        with open(src_srt, "r", encoding="utf-8") as f:
            srt_text = f.read()

        tl_srt = translate_srt_text(srt_text, lang)

        os.makedirs(TRANS_SRT_DIR, exist_ok=True)
        out_name = f"{b}_{lang}.SRT"
        out_path = os.path.join(TRANS_SRT_DIR, out_name)
        with open(out_path, "w", encoding="utf-8") as g:
            g.write(tl_srt)

        return {"ok": True, "message": f"SRT 번역 성공 ({lang})", "translated_srt": out_name, "srt_text": tl_srt}
    except Exception as e:
        return {"ok": False, "error": f"srt-translate failed: {e}"}
