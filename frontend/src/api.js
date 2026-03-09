// src/api.js
// ─────────────────────────────────────────────────────────────
// 프론트↔백엔드 통신 유틸 모음
// - API 베이스
// - JSON fetch 래퍼
// - SSE(openSSE) 진행률 파서 (항상 (NN%) 형식 대응)
// - 업로드→MP3 생성(uploadFileWithSTT) 헬퍼
// - 번역/자막 관련 헬퍼
// ─────────────────────────────────────────────────────────────

export const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

/** JSON 요청 (타임아웃 + 에러 메시지 표준화) */
export async function jsonFetch(url, options = {}) {
  const ctrl = new AbortController();
  const timeoutMs = options.timeout ?? 60_000;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = (isJson ? data?.error || data?.message : data) || `HTTP ${res.status}`;
      return { ok: false, data: null, message: String(msg) };
    }
    return { ok: true, data, message: "" };
  } catch (e) {
    return { ok: false, data: null, message: e?.message || "요청 실패" };
  } finally {
    clearTimeout(timer);
  }
}

/** SSE 연결 (진행률/완료/에러 콜백)
 *  - 진행률은 항상 "(NN%)" 패턴 우선 파싱
 *  - 혹시 다른 포맷이 와도 보조 정규식으로 최소 대응
 */
export function openSSE(path, { onProgress, onDone, onError } = {}) {
  const es = new EventSource(`${API}${path}`);
  const close = () => es.close();

  es.onmessage = (event) => {
    const s = event.data || "";

    // 완료
    if (s.startsWith("done::")) {
      onDone?.(s.slice("done::".length));
      close();
      return;
    }

    // 진행률
    if (s.startsWith("progress::")) {
      const msg = s.slice("progress::".length);
      // ① 표준: "(NN%)"
      let m = msg.match(/\((\d+)%\)/);
      let percent = m ? parseInt(m[1], 10) : undefined;

      // ② 보조: "~NN%" 혹은 "NN%" 단독 등
      if (typeof percent !== "number") {
        m = msg.match(/(\d{1,3})%/);
        if (m) percent = parseInt(m[1], 10);
      }

      onProgress?.({ message: msg, percent });
      return;
    }

    // 에러
    if (s.startsWith("error::")) {
      onError?.(s.slice("error::".length));
      close();
    }
  };

  es.onerror = () => {
    onError?.("SSE 연결 오류");
    close();
  };

  return close;
}

/** 파일 업로드 → MP3 생성까지 (Session1에서 사용 가능)
 *  - 반환: { success, filename, close? }
 *  - 여기서는 STT는 시작하지 않음 (Session2에서 /stt-stream 구독)
 */
export async function uploadFile(file, { onMessage } = {}) {
  const formData = new FormData();
  formData.append("file", file);

  onMessage?.("📤 업로드 시작");

  const { ok, data, message } = await jsonFetch(`${API}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!ok) return { success: false, message: `업로드 실패: ${message}` };

  const filename = (data?.filename || "").toString().split(/[\\/]/).pop();
  if (!filename) return { success: false, message: "서버가 파일명을 반환하지 않았습니다." };

  onMessage?.("MP3 생성 완료");
  return { success: true, filename };
}

/** 유튜브 링크 처리 → MP3 생성 (Session1에서 사용 가능) */
export async function processYoutube(url, { onMessage } = {}) {
  onMessage?.("🎬 유튜브 처리 시작");
  const { ok, data, message } = await jsonFetch(`${API}/youtube-process?url=${encodeURIComponent(url)}`);
  if (!ok) return { success: false, message: `유튜브 처리 실패: ${message}` };

  const filename = (data?.mp3_file || data?.filename || "").toString().split(/[\\/]/).pop();
  if (!filename) return { success: false, message: "서버가 MP3 파일명을 반환하지 않았습니다." };

  onMessage?.("MP3 생성 완료");
  return { success: true, filename };
}

/** 일반 텍스트 번역 */
export async function translateText(text, targetLang) {
  const { ok, data, message } = await jsonFetch(`${API}/translate-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target_lang: targetLang }),
  });
  if (!ok) return { success: false, message: `번역 실패: ${message}`, text: "" };
  return {
    success: true,
    message: data?.message || "번역 완료",
    text: data?.text || data?.translated_text || "",
  };
}

/** SRT 번역 (파일 생성 + 본문 반환) */
export async function translateSrt(baseName, targetLang) {
  const { ok, data, message } = await jsonFetch(`${API}/srt-translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: `${baseName}.srt`, target_lang: targetLang }),
  });
  if (!ok) return { success: false, message: `SRT 번역 실패: ${message}`, srtText: "" };
  return {
    success: true,
    message: data?.message || "SRT 번역 완료",
    srtText: data?.srt_text || "",
    filename: data?.translated_srt || "",
  };
}

/** 언어별 SRT 텍스트 가져오기 (A 방식: lang 필수) */
export async function fetchSrtText(mp3Filename, lang) {
  const qs = new URLSearchParams({
    filename: mp3Filename,
    lang: lang || "ko",
    t: String(Date.now()),
  }).toString();
  const res = await fetch(`${API}/stt-srt?${qs}`);
  if (!res.ok) return { ok: false, text: "" };
  const raw = await res.text();
  const cleaned = raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*\d+\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { ok: true, text: cleaned };
}

/** 언어별 VTT 가져오기 (비디오 <track> 용도) */
export function vttUrl(mp3Filename, lang) {
  const qs = new URLSearchParams({
    filename: mp3Filename,
    lang: lang || "ko",
    t: String(Date.now()),
  }).toString();
  return `${API}/stt-vtt?${qs}`;
}
