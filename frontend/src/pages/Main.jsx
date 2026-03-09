// src/pages/Main.jsx
// 전체 플로우 컨트롤: Session1 → 2 → 3 → 4
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Session1 from "./Session1";
import Session2 from "./Session2";
import Session3 from "./Session3";
import Session4 from "./Session4";
import { WorkflowProvider, useWorkflow } from "../modules/useWorkflow";
import "../css/global.css"; // 통합 전역 스타일

const variants = {
  in: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  out: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

function Switcher() {
  const { step } = useWorkflow();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={step} variants={variants} initial="in" animate="center" exit="out">
        {step === 1 ? <Session1 /> : step === 2 ? <Session2 /> : step === 3 ? <Session3 /> : <Session4 />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Main() {
  return (
    <WorkflowProvider>
      <div className="container" style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
        <h1 style={{ marginBottom: 16 }}>STT 프로젝트</h1>
        <Switcher />
      </div>
    </WorkflowProvider>
  );
}
