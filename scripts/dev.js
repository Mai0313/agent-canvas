const { spawn } = require("child_process");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
let port = "3000"; // Default port
let host = "localhost"; // Default host

// Parse --port and --host parameters
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg.startsWith("--port=")) {
    port = arg.split("=")[1];
  } else if (arg === "--port" && i + 1 < args.length) {
    port = args[++i];
  } else if (arg.startsWith("--host=")) {
    host = arg.split("=")[1];
  } else if (arg === "--host" && i + 1 < args.length) {
    host = args[++i];
  }
}

// Set environment variables
process.env.PORT = port;
process.env.HOST = host;

console.log(`Starting development server on ${host}:${port}`);

// Start React development server with hot reloading
const reactScriptsPath = path.resolve(__dirname, "../node_modules/.bin/react-scripts");

const childProcess = spawn(reactScriptsPath, ["start"], {
  stdio: "inherit",
  env: { ...process.env },
});

// Forward signals
process.on("SIGINT", () => childProcess.kill("SIGINT"));
process.on("SIGTERM", () => childProcess.kill("SIGTERM"));
