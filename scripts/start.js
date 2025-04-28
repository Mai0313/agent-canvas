const { spawn } = require("child_process");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
let port = "3000"; // Default production port
let host = "0.0.0.0"; // Default host for production (accessible from outside)

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

console.log(`Starting production server on ${host}:${port}`);

// Path to the build directory
const buildPath = path.resolve(__dirname, "../build");

// Start serve with appropriate options
const servePath = path.resolve(__dirname, "../node_modules/.bin/serve");
const serveArgs = ["-s", buildPath, "-l", port];

// Note: serve doesn't support --listen-host directly, but we can set the HOST env variable
// which is used by many Node-based servers including serve
process.env.HOST = host;

const childProcess = spawn(servePath, serveArgs, {
  stdio: "inherit",
  env: { ...process.env },
});

// Forward signals
process.on("SIGINT", () => childProcess.kill("SIGINT"));
process.on("SIGTERM", () => childProcess.kill("SIGTERM"));
