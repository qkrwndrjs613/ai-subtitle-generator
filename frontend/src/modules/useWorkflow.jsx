// src/modules/useWorkflow.jsx
// 앱 전역 상태: step/progress/text/filename/lang 등
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [convertedFilename, setConvertedFilename] = useState("");

  // 마지막 번역 언어 기억(세션 지속)
  const [lang, setLang] = useState(() => sessionStorage.getItem("wf_lang") || "");
  useEffect(() => {
    sessionStorage.setItem("wf_lang", lang || "");
  }, [lang]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);
  const reset = useCallback(() => {
    setStep(1);
    setProgress(0);
    setMessage("");
    setText("");
    setConvertedFilename("");
    setLang("");
    sessionStorage.removeItem("wf_lang");
  }, []);

  const value = {
    step, progress, message,
    text, setText,
    convertedFilename, setConvertedFilename,
    lang, setLang,                  
    setProgress, setMessage,
    next, prev, reset,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  return useContext(WorkflowContext);
}
