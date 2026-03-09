// src/pages/Session2.jsx
import React, { useMemo, useRef, useEffect } from "react";
import ProgressBar from "../modules/ProgressBar";
import { useWorkflow } from "../modules/useWorkflow";
import { useSTT } from "../modules/useSTT";
import styles from "../css/sections/Session2.module.css";

export default function StepSTT() {
  const { progress = 0, message = "", convertedFilename = "", next } = useWorkflow();
  const { startSTT, stopSTT } = useSTT();

  // 🔗 페이지 진입 시 SSE 시작, 이탈 시 종료
  useEffect(() => {
    if (convertedFilename) startSTT(convertedFilename);
    return () => stopSTT();
  }, [convertedFilename, startSTT, stopSTT]);

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8001";
  const audioSrc = useMemo(() => {
    if (!convertedFilename) return "";
    return `${API_BASE}/static/${encodeURIComponent(convertedFilename)}`;
  }, [API_BASE, convertedFilename]);

  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current && audioSrc) {
      audioRef.current.load();
      audioRef.current.volume = 0.5;
    }
  }, [audioSrc]);

  const canPlay = !!audioSrc;

  const renderETA = () => {
    if (Number(progress) >= 100) {
      const m = (message || "").match(/STT\s*완료\s*[:：]?\s*(\d+)\s*초\s*소요/);
      return m ? `총 소요시간 ${m[1]}초` : "STT 완료";
    }
    const etaMatch = (message || "").match(/⏱\s*([\d:]+)\s*남음/);
    if (etaMatch) return `예상 남은 시간 ${etaMatch[1]}`;
    return progress < 100 ? "진행 중..." : "";
  };

  return (
    <section className={`card ${styles.card}`}>
      <div className={styles.mediaCard}>
        <div className={styles.cover} aria-hidden>
          <img className={styles.coverImg} src="/MP3.png" alt="MP3 아이콘" />
        </div>

        <div className={styles.fileName} title={convertedFilename || ""}>
          {convertedFilename || "변환된 오디오"}
        </div>

        <div className={styles.narrowWrap}>
          {canPlay ? (
            <audio ref={audioRef} className={styles.audio} controls src={audioSrc} preload="auto" />
          ) : (
            <div className={styles.audioPlaceholder}>오디오를 불러오는 중입니다…</div>
          )}
        </div>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.narrowWrap}>
          <div className={styles.progressLabel}>{renderETA()}</div>
          <ProgressBar progress={progress ?? 0} label="진행률" />
        </div>

        {Number(progress) >= 100 && (
          <button className={styles.nextBtn} onClick={next}>
            결과물 보기
          </button>
        )}
      </div>
    </section>
  );
}
