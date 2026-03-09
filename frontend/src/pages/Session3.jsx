// src/pages/Session3.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkflow } from "../modules/useWorkflow";
import styles from "../css/sections/Session3.module.css";
const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

export default function StepEdit() {
  const { text, setText, convertedFilename, next, setLang: setWorkflowLang } = useWorkflow();

  const [lang, setLang] = useState("ko");  // 사용자가 선택
  const [isBusy, setIsBusy] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle|txt|srt|done|error
  const poller = useRef(null);

  const [isSrt, setIsSrt] = useState(false);
  const [txtBackup, setTxtBackup] = useState("");

  const baseName = useMemo(
    () => (convertedFilename || "").replace(/\.mp3$/i, ""),
    [convertedFilename]
  );

  const stripSrtIndices = (s) =>
    (s || "")
      .split(/\r?\n/)
      .filter((l) => !/^\s*\d+\s*$/.test(l))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // 초기 진입 시 STT 원문 TXT 로드
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      if (!baseName || (text && text.trim())) return;
      try {
        const r = await fetch(`${API}/stt/txt/${encodeURIComponent(baseName)}.txt`);
        if (!r.ok) return;
        const t = (await r.text()).trim();
        if (!canceled && t) setText(t);
      } catch {}
    };
    load();
    return () => { canceled = true; };
  }, [baseName, text, setText]);

  // SRT 보기 토글
  const toggleSrt = async () => {
    if (isSrt) {
      setIsSrt(false);
      setText(txtBackup);
      return;
    }
    if (!convertedFilename) return;
    try {
      setTxtBackup(text || "");
      const r = await fetch(
        `${API}/stt-srt?filename=${encodeURIComponent(convertedFilename)}&lang=${encodeURIComponent(lang)}`
      );
      if (!r.ok) return;
      const cleaned = stripSrtIndices(await r.text());
      if (cleaned) {
        setText(cleaned);
        setIsSrt(true);
      }
    } catch {}
  };

  // 번역하기: 2단계 비동기
  const handleTranslate = async () => {
    if (!baseName || !text?.trim()) return;
    try {
      setIsBusy(true);
      setPhase("txt");

      // ✅ 사용자가 선택한 언어를 전역에 즉시 저장 (4세션에서 사용)
      setWorkflowLang(lang);

      // 1단계: TXT 번역 + 저장, SRT 백그라운드 시작
      const res = await fetch(`${API}/translate-text-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `${baseName}.mp3`, target_lang: lang, start_srt: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPhase("error");
        setIsBusy(false);
        return;
      }

      // TXT 번역 결과 즉시 표시
      setText((data.txt_text || "").trim());
      setPhase("srt");

      // 2단계: SRT 상태 폴링
      if (poller.current) clearInterval(poller.current);
      poller.current = setInterval(async () => {
        try {
          const q = new URLSearchParams({ filename: baseName, target_lang: lang });
          const r = await fetch(`${API}/translate-srt-status?${q.toString()}`);
          const s = await r.json();
          if (s?.status === "done") {
            clearInterval(poller.current);
            poller.current = null;
            setPhase("done");
            setIsBusy(false);
          } else if (s?.status === "error") {
            clearInterval(poller.current);
            poller.current = null;
            setPhase("error");
            setIsBusy(false);
          }
        } catch {
          clearInterval(poller.current);
          poller.current = null;
          setPhase("error");
          setIsBusy(false);
        }
      }, 1500);
    } catch {
      setPhase("error");
      setIsBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (poller.current) clearInterval(poller.current);
    };
  }, []);

  const hint = (() => {
    switch (phase) {
      case "txt": return "TXT 번역하는 중입니다. 잠시만 기다려 주세요…";
      case "srt": return "SRT 번역하는 중입니다. 잠시만 기다려 주세요…";
      case "done": return "TXT + SRT 작업 완료.";
      case "error": return "번역 중 오류가 발생했습니다.";
      default: return "";
    }
  })();

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div className={styles.meta}>
          <strong>원문/번역</strong>
          <span>
            길이: {text?.length ?? 0}자
            {convertedFilename ? ` · 파일: ${convertedFilename}` : ""}
            {isSrt ? " · SRT 보기" : " · TXT 보기"}
          </span>
        </div>
      </div>

      <div className={styles.squareBox}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="2단계에서 생성된 STT 텍스트가 여기에 표시됩니다."
          rows={18}
        />
      </div>

      <div className={styles.miniActions}>
        <div className={styles.leftGroup}>
          <select
            className={styles.select}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={isBusy}
          >
            <option value="ko">한국어</option>
            <option value="en">영어</option>
            <option value="ja">일본어</option>
          </select>

          <button className={styles.primary} onClick={handleTranslate} disabled={isBusy || !text}>
            {isBusy ? (phase === "srt" ? "SRT 번역 중..." : "TXT 번역 중...") : "번역하기"}
          </button>

          <button className={styles.ghost} onClick={toggleSrt} disabled={isBusy || !convertedFilename}>
            {isSrt ? "TXT로 보기" : "SRT로 보기"}
          </button>
        </div>

        <div className={styles.rightGroup}>
          <button className={styles.primary} onClick={next} disabled={isBusy}>영상으로 보기</button>
        </div>
      </div>

      {hint && <p style={{ marginTop: 8, color: "#555" }}>{hint}</p>}
    </section>
  );
}
