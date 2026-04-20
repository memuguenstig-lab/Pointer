'use strict';
const { spawn } = require('child_process');
const tcpPortUsed = require('tcp-port-used');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const runInBackground = args.includes('--background') || args.includes('-b');
const skipChecks = args.includes('--skip-checks') || args.includes('-s');

const BACKEND_PORT = 23816;
const SERVER_PORT = 3000;

async function isPortInUse(port) {
  try { return await tcpPortUsed.check(port, '127.0.0.1'); }
  catch(e) { return false; }
}

async function findAvailablePort(base, max = 10) {
  for (let i = 0; i < max; i++) {
    if (!await isPortInUse(base + i)) return base + i;
  }
  throw new Error('No available port found');
}

function startProcess(command, args, name, color, env = {}) {
  console.log(chalk[color](`Starting ${name}...`));
  const opts = { shell: true, stdio: 'pipe', env: { ...process.env, ...env } };
  if (runInBackground && name !== 'Backend') opts.detached = true;
  const proc = spawn(command, args, opts);
  proc.stdout.on('data', d => console.log(chalk[color](`[${name}] ${d.toString().trim()}`)));
  proc.stderr.on('data', d => console.error(chalk[color](`[${name} ERR] ${d.toString().trim()}`)));
  proc.on('close', code => console.log(chalk[color](`[${name}] exited with code ${code}`)));
  return proc;
}

async function ensureBackendDeps() {
  const nodeModules = path.join(__dirname, 'backend-node', 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log(chalk.yellow('Installing backend dependencies (first run)...'));
    await new Promise((resolve, reject) => {
      const proc = spawn('npm', ['install', '--prefer-offline'], {
        cwd: path.join(__dirname, 'backend-node'),
        shell: true,
        stdio: 'inherit'
      });
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`npm install failed with code ${code}`)));
    });
    console.log(chalk.green('Backend dependencies installed.'));
  }
}

async function main() {
  console.log(chalk.blue('Starting Pointer...'));
  console.log(chalk.blue(`Mode: ${runInBackground ? 'Background' : 'Interactive'}`));
  if (skipChecks) console.log(chalk.yellow('Skip checks enabled: bypassing connection checks'));

  // ── Node.js backend ───────────────────────────────────────────────────────
  let backendRunning = skipChecks ? true : await isPortInUse(BACKEND_PORT);
  let backendProcess = null;

  if (!backendRunning) {
    await ensureBackendDeps();
    console.log(chalk.yellow('Starting Node.js backend...'));
    backendProcess = startProcess('node', ['backend-node/server.js'], 'Backend', 'yellow');

    if (!skipChecks) {
      console.log(chalk.yellow('Waiting for backend to be ready...'));
      try {
        await tcpPortUsed.waitUntilUsed(BACKEND_PORT, 500, 30000);
        console.log(chalk.green('Backend ready.'));
      } catch(e) {
        console.error(chalk.red('Backend failed to start within timeout.'));
        process.exit(1);
      }
    }
  } else {
    console.log(chalk.green('Backend already running.'));
  }

  // ── Vite dev server ───────────────────────────────────────────────────────
  const serverPort = await findAvailablePort(SERVER_PORT);
  console.log(chalk.blue(`Using port ${serverPort} for the Vite dev server.`));
  const serverProcess = startProcess('yarn', ['dev:server'], 'Server', 'blue', {
    VITE_PORT: serverPort.toString()
  });

  if (!skipChecks) {
    try {
      await tcpPortUsed.waitUntilUsed(serverPort, 500, 30000);
      console.log(chalk.green('Vite server ready.'));
    } catch(e) {
      console.error(chalk.red('Vite server failed to start.'));
      if (backendProcess) backendProcess.kill();
      process.exit(1);
    }
  }

  // ── Electron ──────────────────────────────────────────────────────────────
  const electronProcess = startProcess('yarn', ['dev:electron'], 'Electron', 'magenta', {
    VITE_DEV_SERVER_PORT: serverPort.toString(),
    SKIP_CONNECTION_CHECKS: skipChecks ? 'true' : 'false'
  });

  if (runInBackground) {
    if (backendProcess) backendProcess.unref();
    serverProcess.unref();
    electronProcess.unref();
    setTimeout(() => {
      console.log(chalk.green('Pointer is running in the background.'));
      process.exit(0);
    }, 5000);
  } else {
    const cleanup = () => {
      console.log(chalk.red('\nShutting down...'));
      if (backendProcess) backendProcess.kill();
      serverProcess.kill();
      electronProcess.kill();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
