# AI Subtitle Generator

AI-based system that automatically generates subtitles and translated subtitles from YouTube videos.

Built with **FastAPI**, **Faster-Whisper**, and **React**.

The system downloads video/audio, performs speech-to-text using Faster-Whisper, and generates subtitle files automatically.
---

# Features

- YouTube video subtitle generation
- Automatic Speech-to-Text (STT)
- Subtitle translation
- SRT / VTT subtitle generation
- Web interface for subtitle preview

---

# Tech Stack

### Frontend
- React
- JavaScript
- CSS

### Backend
- Python
- FastAPI
- Uvicorn

### AI / Voice
- Faster-Whisper
- CTranslate2

### Media Processing
- FFmpeg
- yt-dlp

### Translation
- Deep-translator

---

## System Workflow

```
User Input (Video / YouTube URL)
        ↓
yt-dlp (video download)
        ↓
FFmpeg (audio extraction)
        ↓
Faster-Whisper (speech-to-text)
        ↓
Deep-Translator (translation)
        ↓
Subtitle Generation (SRT / VTT)
        ↓
Frontend Preview
```

## Installation & Run

### Backend

```
cd backend
pip install fastapi uvicorn faster-whisper deep-translator yt-dlp numpy tqdm
uvicorn main:app --reload --port 8001
```

### Frontend

```
cd frontend
npm install
npm start
```

## Project Structure

```
ai-subtitle-generator
├── backend
│   ├── main.py              # FastAPI server entry point
│   ├── youtube_router.py    # YouTube video processing
│   ├── stt_router.py        # Speech-to-text API
│   ├── translate_router.py  # Translation API
│   ├── upload_router.py     # File upload API
│   ├── caption_router.py    # Subtitle generation
│   ├── stt_model.py         # Faster-Whisper model loader
│   ├── media_utils.py       # FFmpeg media processing
│   └── settings.py          # Server settings

├── frontend
│   ├── public               # Static files
│   ├── src
│   │   ├── pages            # Main UI pages
│   │   ├── modules          # Reusable components & hooks
│   │   ├── css              # Styles
│   │   ├── api.js           # Backend API communication
│   │   ├── App.js           # React root component
│   │   └── index.js         # React entry point
│   └── package.json

└── .gitignore
```
