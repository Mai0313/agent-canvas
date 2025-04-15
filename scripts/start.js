const { spawn } = require('child_process');
const path = require('path');

// 解析命令行參數
const args = process.argv.slice(2);
let port = '3000'; // 預設 port
let host = 'localhost'; // 預設 host

// 解析 --port 和 --host 參數
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg.startsWith('--port=')) {
    port = arg.split('=')[1];
  } else if (arg === '--port' && i + 1 < args.length) {
    port = args[++i];
  } else if (arg.startsWith('--host=')) {
    host = arg.split('=')[1];
  } else if (arg === '--host' && i + 1 < args.length) {
    host = args[++i];
  }
}

// 設置環境變數
process.env.PORT = port;
process.env.HOST = host;

console.log(`Starting development server on ${host}:${port}`);

// 啟動 React 開發伺服器
const reactScriptsPath = path.resolve(
  __dirname,
  '../node_modules/.bin/react-scripts'
);

const childProcess = spawn(reactScriptsPath, ['start'], {
  stdio: 'inherit',
  env: { ...process.env },
});

// 轉發信號
process.on('SIGINT', () => childProcess.kill('SIGINT'));
process.on('SIGTERM', () => childProcess.kill('SIGTERM'));
