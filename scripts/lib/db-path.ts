import os from 'node:os';
import path from 'node:path';
import { PRODUCT_SLUG } from '../../shared/school-defaults';

/** Default SQLite path for the dev app (`electron userData`). */
export function defaultDbPath(): string {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(
      home,
      'Library',
      'Application Support',
      PRODUCT_SLUG,
      'complex-scolaire.sqlite',
    );
  }
  if (process.platform === 'win32') {
    const appData =
      process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, PRODUCT_SLUG, 'complex-scolaire.sqlite');
  }
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  return path.join(configHome, PRODUCT_SLUG, 'complex-scolaire.sqlite');
}
