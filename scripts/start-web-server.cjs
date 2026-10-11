const { spawn } = require('node:child_process');

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this command with npm run web:server.');
  process.exit(1);
}

const server = spawn(process.execPath, [npmCli, 'start'], {
  env: { ...process.env, WEB_SERVER: '1' },
  stdio: 'inherit',
});

server.on('error', (error) => {
  console.error('Could not start the Electron web server:', error);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
