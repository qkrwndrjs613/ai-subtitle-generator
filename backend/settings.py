# settings.py
# 프로젝트에서 사용하는 모든 경로를 한 곳에서 관리합니다.

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "TestDB"))

AVG_DIR   = os.path.join(DATA_DIR, "AVG")        # 영상(mp4)
MP3_DIR   = os.path.join(DATA_DIR, "MP3")        # 오디오(mp3)
STT_DIR   = os.path.join(DATA_DIR, "STT")        # 원문 txt/srt
STT_TXT_DIR   = os.path.join(STT_DIR, "txt")    # 원문 텍스트
STT_SRT_DIR   = os.path.join(STT_DIR, "srt")    # 원문 자막

TRANS_DIR = os.path.join(DATA_DIR, "TRANS")      # 번역 결과 루트
TRANS_TXT_DIR = os.path.join(TRANS_DIR, "txt")   # 번역 텍스트
TRANS_SRT_DIR = os.path.join(TRANS_DIR, "srt")   # 번역 자막
YT_DIR    = os.path.join(DATA_DIR, "YT")         # 유튜브 캐시

# 필요 시 폴더 자동 생성
for d in [
    DATA_DIR,
    AVG_DIR,
    MP3_DIR,
    STT_DIR, STT_TXT_DIR, STT_SRT_DIR,
    TRANS_DIR, TRANS_TXT_DIR, TRANS_SRT_DIR,
    YT_DIR,
]:
    os.makedirs(d, exist_ok=True)