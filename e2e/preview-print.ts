// Throwaway visual check: seeds a payment through the real preload bridge,
// asks PrintService for the receipt/statement HTML, renders it in the app
// window and screenshots it. Run with: npx tsx e2e/preview-print.ts
import path from 'node:path';
import { launchApp, closeApp } from './electron';

async function main() {
  const { app, window, userDataDir } = await launchApp();
  try {
    const docs = await window.evaluate(async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const api = (window as any).api;
      const classLevelId: number = await api.classLevels.upsertStructured({
        code: 'CP',
        display_order: 1,
        labels: { francophone: 'CP' },
      });
      await api.classFees.upsert({
        class_level_id: classLevelId,
        school_year: '2026/2027',
        section: 'Francophone',
        annual_fee: 125_000,
      });
      await api.settings.set('current_school_year', '2026/2027');
      await api.settings.set('director_name', 'Mme Ngo Bakang');
      await api.settings.set('address', 'BP 1234, Douala');
      await api.settings.set('phone', '+237 699 00 00 00');
      const student = await api.students.create({
        matricule: 'MAT-2026-001',
        full_name: 'Awa Preview Testeuse',
        gender: 'Fille',
        guardian_name: 'M. Preview',
        guardian_phone: '+237 677 11 22 33',
      });
      const enrollment = await api.enrollments.create({
        student_id: student.id,
        school_year: '2026/2027',
        class_level_id: classLevelId,
        section: 'Francophone',
      });
      const payment = await api.payments.create({
        enrollment_id: enrollment.id,
        payment_date: '2026-08-22',
        amount: 40_000,
        payment_mode: 'Espèces',
      });
      const receipt = await api.print.paymentReceiptHtml(payment.id);
      const statement = await api.print.studentStatementHtml(enrollment.id);
      return { receipt: receipt.html, statement: statement.html };
    });

    const outDir = path.join(__dirname, '..', '.tmp-print-preview');
    for (const [name, html] of Object.entries(docs)) {
      await window.setContent(html as string);
      await window.screenshot({
        path: path.join(outDir, `${name}.png`),
        fullPage: true,
      });
      console.log(`saved ${name}.png`);
    }
  } finally {
    await closeApp(app, userDataDir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
