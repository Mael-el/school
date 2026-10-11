import fs from 'node:fs/promises';
import path from 'node:path';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../db/schema-types';
import { SettingsService } from './SettingsService';

export interface BackupResult {
  canceled: boolean;
  filePath?: string;
  backedUpAt?: string;
}

const SQLITE_MAGIC = 'SQLite format 3';

export class BackupService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly dbPath: string,
    private readonly settings: SettingsService,
  ) {}

  private async checkpoint(): Promise<void> {
    await sql`PRAGMA wal_checkpoint(FULL)`.execute(this.db);
  }

  private async isValidSqliteFile(filePath: string): Promise<boolean> {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      return buffer.toString('utf8').startsWith(SQLITE_MAGIC);
    } finally {
      await handle.close();
    }
  }

  async createToPath(destPath: string): Promise<string> {
    await this.checkpoint();
    await fs.copyFile(this.dbPath, destPath);
    const backedUpAt = new Date().toISOString();
    await this.settings.set('last_backup_at', backedUpAt);
    return backedUpAt;
  }

  /** Copies the DB to userData/backups/ when auto-backup is due. */
  async runAutoBackupIfDue(userDataPath: string): Promise<string | null> {
    const enabled = (await this.settings.get('auto_backup_enabled')) === '1';
    if (!enabled) return null;

    const intervalDays =
      Number(await this.settings.get('auto_backup_interval_days')) || 1;
    const lastAuto = await this.settings.get('last_auto_backup_at');
    if (lastAuto) {
      const elapsed =
        (Date.now() - new Date(lastAuto).getTime()) / 86_400_000;
      if (elapsed < intervalDays) return null;
    }

    const backupDir = path.join(userDataPath, 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const destPath = path.join(backupDir, `auto-${stamp}.sqlite`);

    await this.checkpoint();
    await fs.copyFile(this.dbPath, destPath);

    const backedUpAt = new Date().toISOString();
    await this.settings.set('last_auto_backup_at', backedUpAt);

    const entries = await fs.readdir(backupDir);
    const autoFiles = entries
      .filter((f) => f.startsWith('auto-') && f.endsWith('.sqlite'))
      .sort()
      .reverse();
    for (const old of autoFiles.slice(7)) {
      await fs.unlink(path.join(backupDir, old)).catch(() => undefined);
    }

    return destPath;
  }

  /** Validates and copies a backup over the live DB (caller restarts app). */
  async prepareRestoreFrom(sourcePath: string): Promise<void> {
    if (!(await this.isValidSqliteFile(sourcePath))) {
      throw new Error(
        "Le fichier sélectionné n'est pas une base SQLite valide.",
      );
    }
    await this.checkpoint();
    await fs.copyFile(sourcePath, this.dbPath);
  }
}
