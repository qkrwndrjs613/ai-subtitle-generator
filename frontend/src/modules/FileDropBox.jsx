// 클릭 또는 드래그 업로드
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import styles from "../css/components/FileDropBox.module.css";

//파일이 드롭되면 실행
export default function FileDropBox({ file, setFile, setYoutubeUrl }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      const selected = acceptedFiles[0];
      if (!selected) return;
      if (!selected.name.match(/\.(mp4|mkv|mov|avi)$/i)) {
        alert("🎞 MP4, MKV, MOV, AVI 형식만 업로드 가능합니다.");
        return;
      }
      setYoutubeUrl?.("");
      setFile(selected);
    },
    [setFile, setYoutubeUrl]
  );

  // 드롭 영역
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      {...getRootProps()}
      className={`${styles.box} ${isDragActive ? styles.active : ""}`}
    >
      <input {...getInputProps()} />
      <p className={styles.text}>
        {file ? (
          <>
            <strong>{file.name}</strong> 선택 되었습니다.
          </>
        ) : isDragActive ? (
          "파일을 여기에 놓으세요"
        ) : (
          "클릭하거나 드래그하여 영상을 업로드"
        )}
      </p>
    </div>
  );
}
