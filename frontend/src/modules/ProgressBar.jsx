// 진행률 
import React from "react";
import styles from "../css/components/ProgressBar.module.css";

// props 받기
export default function ProgressBar({ progress = 0, label }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className={styles.wrap} aria-label="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar">
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.info}>
        <span className={styles.label}>{label || "진행률"}</span>
        <span className={styles.value}>{pct}%</span>
      </div>
    </div>
  );
}
