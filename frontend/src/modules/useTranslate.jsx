// src/modules/useTranslate.jsx
// ──────────────────────────────────────────────
// 일반 텍스트 번역 훅
// - 백엔드 /translate-text 사용
// - 상태(loading, error, lastResult) 관리
// ──────────────────────────────────────────────
import { useState, useCallback } from "react";
const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

export function useTranslate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState("");

  const translate = useCallback(async (text, lang) => {
    if (!text?.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/translate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang: lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const out = data.text || data.translated_text || data.result || "";
      if (out?.trim()) setLastResult(out.trim());
      return { success: true, text: out.trim() };
    } catch (err) {
      setError(`번역 실패: ${String(err.message || err)}`);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return { translate, loading, error, lastResult };
}
