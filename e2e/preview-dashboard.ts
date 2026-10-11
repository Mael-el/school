// Throwaway visual check for the redesigned home: seeds realistic data
// through the preload bridge, reloads, and screenshots the dashboard.
// Run with: npx tsx e2e/preview-dashboard.ts
import path from 'node:path';
import { launchApp, closeApp } from './electron';

async function main() {
  const { app, window, userDataDir } = await launchApp();
  try {
    await window.evaluate(async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const api = (window as any).api;
      const year = '2026/2027';
      const classLevelId: number = await api.classLevels.upsertStructured({
        code: 'CP',
        display_order: 1,
        labels: { francophone: 'CP' },
      });
      await api.classFees.upsert({
        class_level_id: classLevelId,
        school_year: year,
        section: 'Francophone',
        annual_fee: 125_000,
      });
      await api.settings.set('current_school_year', year);
      await api.settings.set(
        'school_name',
        'Complexe Scolaire Émergence de Ngaoundéré',
      );
      for (let i = 1; i <= 3; i++) {
        const student = await api.students.create({
          matricule: `MAT-2026-00${i}`,
          full_name: `Élève Démo ${i}`,
          gender: i % 2 ? 'Fille' : 'Garçon',
        });
        const enrollment = await api.enrollments.create({
          student_id: student.id,
          school_year: year,
          class_level_id: classLevelId,
          section: 'Francophone',
        });
        if (i < 3) {
          await api.payments.create({
            enrollment_id: enrollment.id,
            payment_date: '2026-08-10',
            amount: i === 1 ? 125_000 : 50_000,
            payment_mode: 'Espèces',
          });
        }
      }
      await api.expenses.create({
        expense_date: '2026-08-15',
        description: 'Fournitures de rentrée',
        amount: 35_000,
        payment_mode: 'Espèces',
      });
    });

    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    const outDir = path.join(__dirname, '..', '.tmp-print-preview');
    await window.screenshot({
      path: path.join(outDir, 'dashboard.png'),
      fullPage: true,
    });
    console.log('saved dashboard.png');

    // The app scrolls inside <main>, so fullPage doesn't reach the bottom
    // panels — scroll the container and capture a second shot.
    await window.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = main.scrollHeight;
    });
    await window.waitForTimeout(400);
    await window.screenshot({
      path: path.join(outDir, 'dashboard-bottom.png'),
    });
    console.log('saved dashboard-bottom.png');
  } finally {
    await closeApp(app, userDataDir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
