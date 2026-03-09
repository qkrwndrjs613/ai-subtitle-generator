// 변환 MP3 미리듣기/다운로드/제거
import React, { useEffect, useRef } from "react";
import styles from "../css/components/AudioPreview.module.css";

export default function AudioPreview({ src, filename, onRemove }) {
  const audioRef = useRef(null);

  // 오디오 자동 새로고침
  useEffect(() => {
    audioRef.current.volume = 0.5;
    if (audioRef.current && src) audioRef.current.load();
  }, [src]);

  if (!src) return null;

  // 다운로드 및 제거 기능 / 오디오 플레이어
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <strong className={styles.name}>{filename || "audio.mp3"}</strong>
        <div className={styles.actions}>
          <a className={styles.btn} href={src} download={filename || "audio.mp3"}>
            다운로드
          </a>
          {onRemove && (
            <button type="button" className={styles.btnGhost} onClick={onRemove}>
              제거
            </button>
          )}
        </div>
      </div>

      <audio ref={audioRef} className={styles.audio} controls>
        <source src={src} />
        브라우저가 오디오 태그를 지원하지 않습니다.
      </audio>
    </div>
  );
}

