// src/modules/useSTT.jsx
// ──────────────────────────────────────────────
// STT 진행 상태를 SSE(Server-Sent Events)로 구독하는 훅
// - 백엔드 /stt-stream 엔드포인트와 연결
// - 진행률(progress), 메시지(message) 실시간 업데이트
// - 세그먼트가 적어도 완료 시 100%로 표시되도록 보정
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { useWorkflow } from "./useWorkflow";

const API = process.env.REACT_APP_API_BASE || "http://localhost:8001";

export function useSTT() {
  const { setProgress, setMessage, setText } = useWorkflow();

  const startSTT = useCallback(
    (filename) => {
      if (!filename) return;

      const url = `${API}/stt-stream?filename=${encodeURIComponent(filename)}`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        const data = event.data || "";

        // 진행률
        if (data.startsWith("progress::")) {
          const msg = data.replace("progress::", "").trim();
          setMessage(msg);

          const match = msg.match(/\((\d+)%\)/); // "(NN%)" 패턴
          let p = match ? parseInt(match[1], 10) : 0;

          // 진행률이 너무 적거나 0으로 멈출 때 보정
          if (p < 1 && msg.includes("남음")) {
            p = 5; // 최소 5% 정도로 표시
          }

          setProgress(p);

          // "STT 완료"나 "총 소요시간" 문구가 보이면 강제 100%
          if (msg.includes("총 소요시간") || msg.includes("완료")) {
            setProgress(100);
          }
        }

        // 완료
        else if (data.startsWith("done::")) {
          const content = data.replace("done::", "");
          const parts = content.split("\n");
          const summary = parts.shift();
          const body = parts.join("\n").trim();

          setMessage(summary || "STT 완료");
          setText(body);

          // 완료 이벤트 수신 시 100% 강제 고정
          setProgress(100);
          eventSource.close();
        }

        // 오류
        else if (data.startsWith("error::")) {
          setMessage(data.replace("error::", "오류 발생: "));
          setProgress(100);
          eventSource.close();
        }
      };

      // SSE 연결 오류/끊김
      eventSource.onerror = () => {
        setMessage("연결이 끊어졌습니다. (SSE 오류)");
        setProgress((p) => (p < 100 ? 100 : p));
        eventSource.close();
      };

      // stop 함수 리턴
      return () => {
        setProgress((p) => (p < 100 ? 100 : p));
        eventSource.close();
      };
    },
    [setProgress, setMessage, setText]
  );

  const stopSTT = useCallback(() => {
    // 수동 정지 훅
  }, []);

  return { startSTT, stopSTT };
}
