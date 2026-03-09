// src/pages/Session1.jsx
import React, { useState } from "react";
import FileDropBox from "../modules/FileDropBox";
import { useWorkflow } from "../modules/useWorkflow";
import styles from "../css/sections/Session1.module.css";

const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

// 유튜브 ID 추출 (짧은/긴/shorts 모두 허용)
function extractYoutubeId(url = "") {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function StepUpload() {
  const { setProgress, setMessage, setConvertedFilename, next } = useWorkflow();

  // 로컬 상태
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  // 파일 업로드
  const handleUpload = async () => {
    if (!file) return setMessage("먼저 영상을 선택하세요.");
    setBusy(true);
    setLoading(true);
    setMessage("업로드 중…");
    setProgress(0);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data?.error)
        throw new Error(data?.error || data?.message || "업로드 실패");

      // ✅ MP3 파일명 저장만 하고, 바로 2페이지로 이동
      const mp3 = (data?.filename || "").toString().split("/").pop();
      if (!mp3) throw new Error("서버가 파일명을 반환하지 않았습니다.");

      setConvertedFilename(mp3);
      setMessage("STT 준비됨");
      next(); // ➜ StepSTT로 이동 (SSE는 거기서 시작)
    } catch (err) {
      setMessage(`업로드 실패: ${String(err.message || err)}`);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  // 유튜브 처리
  const handleYoutube = async () => {
    if (!youtubeUrl) return setMessage("유튜브 링크를 입력하세요.");
    const yid = extractYoutubeId(youtubeUrl);
    if (!yid) return setMessage("올바른 유튜브 링크가 아닙니다.");

    setBusy(true);
    setLoading(true);
    setMessage("유튜브 다운로드 및 변환 준비…");
    setProgress(0);

    try {
      const r = await fetch(`${API}/youtube-process?url=${encodeURIComponent(youtubeUrl)}`);
      const data = await r.json();
      if (!r.ok || data?.error)
        throw new Error(data?.error || data?.message || "유튜브 처리 실패");

      const mp3 = (data?.mp3_file || data?.filename || "").toString().split("/").pop();
      if (!mp3) throw new Error("서버가 MP3 파일명을 반환하지 않았습니다.");

      setConvertedFilename(mp3);
      setMessage("STT 준비됨");
      next(); // ➜ StepSTT로 이동
    } catch (err) {
      setMessage(`유튜브 처리 실패: ${String(err.message || err)}`);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "upload" ? "youtube" : "upload"));
    setFile(null);
    setYoutubeUrl("");
    setMessage("");
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>{mode === "upload" ? "영상 업로드" : "유튜브 링크"}</h2>

      <div className={styles.inputArea}>
        {mode === "upload" ? (
          <FileDropBox file={file} setFile={setFile} setYoutubeUrl={setYoutubeUrl} />
        ) : (
          <div className={styles.youtubeBox}>
            <input
              className={styles.ytInput}
              type="text"
              value={youtubeUrl}
              placeholder="https://www.youtube.com/…"
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={busy}
            />
            {extractYoutubeId(youtubeUrl) && (
              <div className={styles.videoWrap}>
                <iframe
                  title="YouTube Preview"
                  src={`https://www.youtube.com/embed/${extractYoutubeId(youtubeUrl)}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.button} ${styles.secondary}`}
          onClick={toggleMode}
          disabled={busy}
        >
          {mode === "upload" ? "유튜브 링크로 전환" : "영상 업로드로 전환"}
        </button>

        {mode === "upload" ? (
          <button className={styles.button} onClick={handleUpload} disabled={busy || !file}>
            업로드 및 변환 시작
          </button>
        ) : (
          <button
            className={styles.button}
            onClick={handleYoutube}
            disabled={busy || !youtubeUrl}
          >
            유튜브 영상변환 시작
          </button>
        )}
      </div>

      {loading && (
        <div className={styles.loadingBox}>
          <div className={styles.spinner}></div>
          <p>잠시만 기다려주세요. 규모를 파악하는 중입니다...</p>
        </div>
      )}
    </section>
  );
}
