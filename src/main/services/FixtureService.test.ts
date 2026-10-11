import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type AppDatabase } from '../db/connection';
import { SettingsService } from './SettingsService';
import { FixtureService } from './FixtureService';

describe('FixtureService', () => {
  let app: AppDatabase;
  let fixtures: FixtureService;
  let settings: SettingsService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    fixtures = new FixtureService(app.db);
    settings = new SettingsService(app.db);
    await settings.set('school_name', 'École Test');
    await settings.set('current_school_year', '2025/2026');
  });

  it('loads demo students and payments while keeping school identity', async () => {
    const result = await fixtures.loadDemo('demo', true);
    expect(result.studentCount).toBeGreaterThan(0);
    expect(result.paymentCount).toBeGreaterThan(0);
    expect(await settings.get('school_name')).toBe('École Test');
    expect(await settings.get('current_school_year')).toBe('2025/2026');

    const enrollments = await app.db
      .selectFrom('enrollments')
      .selectAll()
      .execute();
    expect(enrollments.length).toBeGreaterThan(0);
    expect(enrollments.every((row) => row.school_year === '2025/2026')).toBe(
      true,
    );
  });

  it('replaces identity when keepSettings is false', async () => {
    await fixtures.loadDemo('demo', false);
    expect(await settings.get('school_name')).toBe('École de démonstration');
    expect(await settings.get('current_school_year')).toBe('2026/2027');
  });

  it('drops the previous logo when settings are replaced', async () => {
    await settings.set('school_logo_path', '/tmp/does-not-exist-logo.png');
    await fixtures.loadDemo('emergence', false);
    expect(await settings.get('school_logo_path')).toBeNull();
  });

  it('keeps the logo when keepSettings is true', async () => {
    await settings.set('school_logo_path', '/tmp/does-not-exist-logo.png');
    await fixtures.loadDemo('demo', true);
    expect(await settings.get('school_logo_path')).toBe(
      '/tmp/does-not-exist-logo.png',
    );
  });

  it('loads the Émergence profile with its identity and class structure', async () => {
    const result = await fixtures.loadDemo('emergence', false);
    expect(result.classCount).toBe(10);
    expect(result.studentCount).toBeGreaterThan(0);
    expect(await settings.get('school_name')).toBe(
      'Complexe Scolaire Bilingue Émergence de Ngaoundéré',
    );
    expect(await settings.get('receipt_prefix')).toBe('EMG');

    const staff = await app.db
      .selectFrom('staff_members')
      .selectAll()
      .execute();
    expect(staff).toHaveLength(6);
  });

  it('keeps the current identity when loading Émergence with keepSettings', async () => {
    await fixtures.loadDemo('emergence', true);
    expect(await settings.get('school_name')).toBe('École Test');
    expect(await settings.get('current_school_year')).toBe('2025/2026');
    const enrollments = await app.db
      .selectFrom('enrollments')
      .selectAll()
      .execute();
    expect(
      enrollments.every((row) => row.school_year === '2025/2026'),
    ).toBe(true);
  });
});
