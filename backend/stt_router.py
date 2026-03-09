# stt_router.py
# ─────────────────────────────────────────────────────────────
# SSE(Server-Sent Events)로 STT 진행률/ETA/완료 텍스트를 전송.
# - 진행률 메시지는 항상 "(NN%)" 형식으로 통일 → 프론트 파서 호환.
# - ffprobe 실패(혹은 초단편 오디오) 시에도 100%/done을 반드시 전송.
# - 이미 STT txt가 있으면 캐시 히트: 100% 한 번 쏘고 done 표준 포맷으로 즉시 종료.
# - 완료 시 원문 SRT를 STT_DIR에 생성.
# ─────────────────────────────────────────────────────────────
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from settings import MP3_DIR, STT_DIR
from stt_model import model
import os, subprocess, time, asyncio
from settings import STT_TXT_DIR, STT_SRT_DIR

router = APIRouter()

def ffprobe_duration(path: str) -> float | None:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error",
             "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            stderr=subprocess.DEVNULL
        )
        return float(out.decode().strip())
    except Exception:
        return None

def mmss(sec: float | None) -> str:
    if sec is None:
        return "--:--"
    s = max(0, int(sec))
    return f"{s//60:02d}:{s%60:02d}"

def format_timestamp(seconds: float) -> str:
    """SRT 타임스탬프 포맷: HH:MM:SS,mmm"""
    s = max(0, seconds)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    x = s - int(s)
    sec = int(s % 60)
    ms = int(round(x * 1000))
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

def write_srt(segments, srt_path: str):
    try:
        with open(srt_path, "w", encoding="utf-8") as f:
            for i, seg in enumerate(segments, 1):
                start = format_timestamp(getattr(seg, "start", 0.0))
                end   = format_timestamp(getattr(seg, "end", 0.0))
                text  = (getattr(seg, "text", "") or "").strip()
                f.write(f"{i}\n{start} --> {end}\n{text}\n\n")
    except Exception:
        # SRT 실패는 핵심 흐름엔 영향 없음
        pass

@router.get("/stt-stream")
async def stt_stream(request: Request, filename: str):
    """
    입력: MP3_DIR/filename
    출력: SSE 스트림 (progress::..., done::..., error::...)
    """
    mp3_path = os.path.join(MP3_DIR, filename)
    base = filename.replace(".mp3", "")
    txt_path = os.path.join(STT_TXT_DIR, f"{base}.TXT")
    srt_path = os.path.join(STT_SRT_DIR, f"{base}.SRT")

    async def gen():
        # 캐시 히트: 이미 txt가 있으면 즉시 완료 처리 (표준 포맷)
        if os.path.exists(txt_path) and os.path.getsize(txt_path) > 0:
            yield f"data: progress::{mmss(0)}/{mmss(0)} (100%) ⏱ 00:00 남음\n\n"
            with open(txt_path, "r", encoding="utf-8") as f:
                text = f.read()
            yield f"data: done::STT 완료 : 0초 소요\n{text}\n\n"
            return

        total = ffprobe_duration(mp3_path)
        start_t = time.time()

        # 연결 유지용 하트비트
        async def heartbeat():
            while True:
                await asyncio.sleep(0.4)
                if await request.is_disconnected():
                    break
        hb = asyncio.create_task(heartbeat())

        # 초기 0% 송출
        yield f"data: progress::{mmss(0)}/{mmss(total)} (0%) ⏱ 계산 중...\n\n"

        # 전사 시작
        full_text_parts = []
        last_percent = -1
        segments_collected = []

        try:
            segments_gen, _ = model.transcribe(mp3_path)

            for seg in segments_gen:
                seg_text = (getattr(seg, "text", "") or "")
                seg_end  = getattr(seg, "end", None)
                full_text_parts.append(seg_text)
                segments_collected.append(seg)

                elapsed = time.time() - start_t

                # 1) 총 길이가 있을 때: 정확 진행률
                if total and seg_end is not None:
                    cur = min(max(0.0, float(seg_end)), total)
                    percent = min(99, int(cur / total * 100))
                    eta = "계산 중..."
                    if percent > 0:
                        remaining = elapsed * (100 / max(1, percent) - 1)
                        m = max(0, int(remaining)); eta = f"{m//60:02d}:{m%60:02d} 남음"
                    if percent != last_percent:
                        yield f"data: progress::{mmss(cur)}/{mmss(total)} ({percent}%) ⏱ {eta}\n\n"
                        last_percent = percent

                # 2) 총 길이 모를 때: 근사 진행률
                else:
                    percent = 1 if last_percent < 1 else min(99, last_percent + 5)
                    eta = "계산 중..."
                    if percent > 0:
                        remaining = elapsed * (100 / max(1, percent) - 1)
                        r = max(0, int(remaining)); eta = f"{r//60:02d}:{r%60:02d} 남음"
                    if percent != last_percent:
                        yield f"data: progress::{mmss(None)}/{mmss(None)} ({percent}%) ⏱ {eta}\n\n"
                        last_percent = percent

                if await request.is_disconnected():
                    hb.cancel()
                    return
                await asyncio.sleep(0.02)

            # 완료 처리
            hb.cancel()
            text = "".join(full_text_parts)
            os.makedirs(STT_DIR, exist_ok=True)
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)

            # 원문 SRT 생성 (실패해도 흐름엔 영향 없음)
            write_srt(segments_collected, srt_path)

            # 마지막 100%
            yield f"data: progress::{mmss(total)}/{mmss(total)} (100%) ⏱ 00:00 남음\n\n"

            total_time = int(time.time() - start_t)
            yield f"data: done::STT 완료 : {total_time}초 소요\n{text}\n\n"

        except Exception as e:
            hb.cancel()
            yield f"data: error::{e}\n\n"

    # ✅ SSE 버퍼링 방지 헤더 추가
    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
