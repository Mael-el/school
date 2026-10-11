import path from 'node:path';
import { launchApp, closeApp } from './electron';

async function main() {
  const { app, window, userDataDir } = await launchApp();
  try {
    await window.getByRole('navigation').getByRole('button', { name: 'Aide' }).click();
    await window.waitForTimeout(400);
    const outDir = path.join(__dirname, '..', '.tmp-print-preview');
    await window.screenshot({
      path: path.join(outDir, 'help.png'),
      fullPage: true,
    });
    console.log('saved help.png');
  } finally {
    await closeApp(app, userDataDir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
