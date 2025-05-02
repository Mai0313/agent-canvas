import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 從環境變數讀取根路徑設定，如果未設置則使用預設值
const ROOT_PATH = process.env.REACT_APP_ROOT_PATH || "";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App basePath={ROOT_PATH} />
  </React.StrictMode>,
);
