# media_utils.py
# ─────────────────────────────────────────────────────────────
# ffmpeg 기반 인코딩/추출 유틸 모음
# - mp4의 오디오 트랙을 aac로 재인코딩하여 호환성 확보(_fixed.mp4)
# - moviepy를 쓰지 않고 ffmpeg로 mp3를 바로 뽑는 함수도 옵션으로 제공
# ─────────────────────────────────────────────────────────────
import os
import subprocess
import shlex

def run(cmd: list[str] | str) -> int:
    """서브프로세스로 명령을 실행합니다. (stdout/stderr 숨김)"""
    if isinstance(cmd, str):
        cmd = shlex.split(cmd)
    return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode

def reencode_audio_mp4(input_path: str) -> str:
    """
    MP4 비디오는 그대로 복사, 오디오만 AAC로 재인코딩해 호환성 높은 파일을 생성.
    반환: *_fixed.mp4 경로
    """
    assert input_path.lower().endswith(".mp4"), "입력은 .mp4 여야 합니다."
    output_path = input_path.replace(".mp4", "_fixed.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        output_path
    ]
    run(cmd)
    return output_path

def extract_mp3_with_ffmpeg(input_mp4: str, output_mp3: str) -> str:
    """
    ffmpeg로 직접 mp3를 추출합니다. (moviepy 대체 옵션)
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", input_mp4,
        "-vn",               # 비디오는 제외
        "-acodec", "libmp3lame", "-q:a", "2",
        output_mp3
    ]
    run(cmd)
    return output_mp3
