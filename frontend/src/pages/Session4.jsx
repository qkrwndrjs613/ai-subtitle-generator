// src/pages/Session4.jsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import { useWorkflow } from "../modules/useWorkflow";
import styles from "../css/sections/Session4.module.css";

const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

export default function StepPreview() {
  const { convertedFilename, prev, reset, lang: workflowLang } = useWorkflow();

  // 3세션에서 저장된 언어가 있으면 그 번역 자막, 없으면 원문
  const [preferredLang] = useState(workflowLang || "");

  // 파일명 정리(중복 _fixed 방지)
  const rawBase = useMemo(
    () => (convertedFilename || "").replace(/\.(mp3|wav|m4a)$/i, ""),
    [convertedFilename]
  );
  const baseForVideo = useMemo(() => rawBase.replace(/_fixed$/i, ""), [rawBase]);

  const videoSrc = useMemo(
    () => (baseForVideo ? `${API}/uploads/${encodeURIComponent(baseForVideo)}_fixed.mp4` : ""),
    [baseForVideo]
  );

  // 처음엔 원문 VTT, 번역 쓸 준비가 되면 교체
  const [activeLang, setActiveLang] = useState(""); // ""=원문, "en/ja"=번역
  const vttSrc = useMemo(() => {
    if (!convertedFilename) return "";
    const q = new URLSearchParams({
      filename: convertedFilename,
      ...(activeLang && { lang: activeLang }),
      t: String(Date.now()),
    }).toString();
    return `${API}/stt-vtt?${q}`;
  }, [convertedFilename, activeLang]);

  // 번역본 존재 여부 폴링(최대 ~18초)
  useEffect(() => {
    if (!convertedFilename || !preferredLang) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const q = new URLSearchParams({
        filename: convertedFilename,
        lang: preferredLang,
        t: String(Date.now()),
      }).toString();
      const r = await fetch(`${API}/stt-vtt?${q}`, { method: "GET" });
      if (r.ok) {
        setActiveLang(preferredLang);
        clearInterval(timer);
      }
      if (tries >= 12) clearInterval(timer); // 12 * 1.5s ≈ 18초
    }, 1500);
    return () => clearInterval(timer);
  }, [convertedFilename, preferredLang]);

  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && videoSrc) {
      videoRef.current.load();
      videoRef.current.volume = 0.5; // 기본 볼륨 50%
    }
  }, [videoSrc, vttSrc]);

  return (
    <section className={styles.card}>
      <div className={styles.playerWrap}>
        {videoSrc ? (
          <video ref={videoRef} className={styles.video} src={videoSrc} controls crossOrigin="anonymous">
            {vttSrc && (
              <track
                kind="subtitles"
                src={vttSrc}
                srcLang={activeLang || "auto"}
                label={activeLang ? `자막 (${activeLang})` : "원문 자막"}
                default
              />
            )}
          </video>
        ) : (
          <div className={styles.placeholder}>영상 경로를 찾을 수 없습니다.</div>
        )}
      </div>

      <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
        <button className={styles.ghost} onClick={prev}>⬅ 3단계로</button>
        <button className={styles.dark} onClick={reset}>처음으로</button>
      </div>

      <p className={styles.help}>* 자막이 보이지 않으면 잠시 후 다시 시도하세요.</p>
    </section>
  );
}
