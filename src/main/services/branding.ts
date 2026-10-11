import fs from 'node:fs/promises';
import path from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import {
  APP_DISPLAY_NAME,
  APP_WINDOW_TITLE,
} from '../../../shared/school-defaults';
import { SettingsService } from './SettingsService';

export interface SchoolBranding {
  schoolName: string;
  schoolShortName: string;
  windowTitle: string;
  logoDataUrl: string | null;
}

const BRANDING_SETTING_KEYS = new Set([
  'school_name',
  'school_short_name',
  'school_logo_path',
]);

export function isBrandingSettingKey(key: string): boolean {
  return BRANDING_SETTING_KEYS.has(key);
}

async function readLogoDataUrl(logoPath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(logoPath);
    const ext = path.extname(logoPath).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function getSchoolBranding(
  db: Kysely<Database>,
): Promise<SchoolBranding> {
  const settings = new SettingsService(db);
  const schoolName =
    (await settings.get('school_name')) ?? 'Mon établissement scolaire';
  const schoolShortName =
    (await settings.get('school_short_name')) ?? APP_DISPLAY_NAME;
  const windowTitle =
    schoolShortName.trim() || schoolName.trim() || APP_WINDOW_TITLE;
  const logoPath = await settings.get('school_logo_path');
  const logoDataUrl = logoPath ? await readLogoDataUrl(logoPath) : null;

  return { schoolName, schoolShortName, windowTitle, logoDataUrl };
}

export async function getLogoDataUrl(
  db: Kysely<Database>,
): Promise<string | null> {
  const settings = new SettingsService(db);
  const logoPath = await settings.get('school_logo_path');
  if (!logoPath) return null;
  return readLogoDataUrl(logoPath);
}
