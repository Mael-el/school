// Loads a bundled school profile so a packaged install can seed test data
// without running npm scripts.
import fs from 'node:fs/promises';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import demoProfile from '../../../profiles/demo.json';
import emergenceProfile from '../../../profiles/emergence.json';
import {
  applySchoolProfile,
  type ApplyProfileResult,
} from '../../../scripts/lib/apply-profile';
import type { SchoolProfile } from '../../../scripts/lib/profile-types';
import { SettingsService } from './SettingsService';

export type LoadFixturesResult = ApplyProfileResult;

export const FIXTURE_PROFILES = ['demo', 'emergence'] as const;
export type FixtureProfileId = (typeof FIXTURE_PROFILES)[number];

const PROFILES: Record<FixtureProfileId, unknown> = {
  demo: demoProfile,
  emergence: emergenceProfile,
};

export class FixtureService {
  constructor(private readonly db: Kysely<Database>) {}

  async loadDemo(
    profileId: FixtureProfileId,
    keepSettings: boolean,
  ): Promise<LoadFixturesResult> {
    const source = PROFILES[profileId] ?? PROFILES.demo;
    const settings = new SettingsService(this.db);
    const previous = keepSettings ? await settings.getAll() : null;
    const profile = structuredClone(source) as SchoolProfile;
    const keepYear = previous?.current_school_year?.trim();
    if (keepYear) {
      profile.settings = {
        ...profile.settings,
        current_school_year: keepYear,
      };
      if (profile.demo) {
        profile.demo = { ...profile.demo, school_year: keepYear };
      }
    }
    const result = await applySchoolProfile(this.db, profile, { reset: true });
    if (previous) {
      await settings.setMany(previous);
    } else {
      // Replacing settings: drop the previous school's logo, since profiles
      // don't ship one and the template defaults leave the key untouched.
      const logoPath = await settings.get('school_logo_path');
      await settings.set('school_logo_path', null);
      if (logoPath) {
        try {
          await fs.unlink(logoPath);
        } catch {
          // Missing file is fine — the setting is already cleared.
        }
      }
    }
    return result;
  }
}
