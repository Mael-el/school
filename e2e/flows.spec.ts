import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, closeApp } from './electron';

const SCHOOL_YEAR = '2026/2027';
const STUDENT_NAME = 'Awa E2E Testeuse';
const STAFF_NAME = 'Moussa E2E Enseignant';
const EXPENSE_DESC = 'Achat craies E2E';
const EXPENSE_DESC_EDITED = 'Achat craies E2E (corrigé)';
const STAFF_NAME_EDITED = 'Moussa E2E Directeur';

/**
 * End-to-end business flows against a fresh database:
 * reference data is seeded through the real preload bridge (window.api),
 * then every flow is driven through the UI exactly like a user would.
 */
test.describe('Business flows', () => {
  test.describe.configure({ mode: 'serial' });

  let app: ElectronApplication;
  let window: Page;
  let userDataDir: string;

  const nav = (name: string) =>
    window.getByRole('navigation').getByRole('button', { name });

  test.beforeAll(async () => {
    ({ app, window, userDataDir } = await launchApp());

    // Seed the minimum reference data a school would configure on first run:
    // one class level (CP, Francophone) with an annual fee, and the school year.
    await window.evaluate(
      async ({ year }) => {
        interface SeedApi {
          classLevels: {
            upsertStructured: (input: object) => Promise<number>;
          };
          classFees: { upsert: (input: object) => Promise<unknown> };
          settings: { set: (key: string, value: string) => Promise<unknown> };
        }
        const api = (window as unknown as { api: SeedApi }).api;
        const classLevelId: number = await api.classLevels.upsertStructured({
          code: 'CP',
          display_order: 1,
          labels: { francophone: 'CP' },
        });
        await api.classFees.upsert({
          class_level_id: classLevelId,
          school_year: year,
          section: 'Francophone',
          annual_fee: 100_000,
        });
        await api.settings.set('current_school_year', year);
      },
      { year: SCHOOL_YEAR },
    );
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await expect(
      window.getByRole('heading', { name: 'Accueil' }),
    ).toBeVisible();
  });

  test.afterAll(async () => {
    await closeApp(app, userDataDir);
  });

  test('registers a new student with an enrollment', async () => {
    await nav('Élèves').click();
    // Toolbar and empty-state both offer the action on a fresh database.
    await window
      .getByRole('button', { name: 'Ajouter un élève' })
      .first()
      .click();

    // Matricule and registration number are auto-generated on form open.
    await expect(window.locator('#student-matricule')).not.toHaveValue('');
    await window.locator('#student-full-name').fill(STUDENT_NAME);
    // Section and class are searchable comboboxes, not native selects.
    await window.locator('#student-section').click();
    await window.getByRole('option', { name: 'Francophone' }).click();
    await window.locator('#student-class').click();
    await window.getByRole('option', { name: 'CP' }).click();

    await window.getByRole('button', { name: "Inscrire l'élève" }).click();

    await expect(
      window.getByText('Élève inscrit avec succès.'),
    ).toBeVisible();
    await expect(window.getByText(STUDENT_NAME)).toBeVisible();
    await expect(window.getByText('Non payé').first()).toBeVisible();
  });

  test('records a payment for the enrollment', async () => {
    await nav('Paiements').click();
    await window
      .getByRole('button', { name: 'Enregistrer un paiement' })
      .click();

    // Pick the student in the enrollment combobox.
    await window
      .getByRole('button', { name: '— Sélectionner —' })
      .first()
      .click();
    await window
      .getByRole('button', { name: new RegExp(STUDENT_NAME) })
      .click();

    await window.locator('#payment-amount').fill('40000');
    await window
      .getByRole('button', { name: 'Enregistrer le paiement' })
      .click();

    await expect(window.getByText(/Paiement enregistré — reçu/)).toBeVisible();

    // Back on the list: payments only appear once a student is selected
    // in the toolbar filter.
    await window
      .getByRole('button', { name: '— Sélectionner —' })
      .first()
      .click();
    await window
      .getByRole('button', { name: new RegExp(STUDENT_NAME) })
      .click();
    await expect(window.getByText('Validé').first()).toBeVisible();
  });

  test('cancelling the delete modal keeps the payment', async () => {
    // Still on the payments list with the payment row visible.
    await window.getByRole('button', { name: 'Supprimer' }).first().click();
    // The row also has an "Annuler" (cancel payment) action, so scope the
    // click to the dialog (labelled by its title).
    const dialog = window.getByLabel('Supprimer ce paiement ?');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();

    await expect(window.getByText('Supprimer ce paiement ?')).toBeHidden();
    await expect(window.getByText('Validé').first()).toBeVisible();
  });

  test('records an expense', async () => {
    await nav('Dépenses').click();
    await window
      .getByRole('button', { name: 'Nouvelle dépense' })
      .first()
      .click();

    await window.locator('#expense-description').fill(EXPENSE_DESC);
    await window.locator('#expense-amount').fill('15000');
    await window
      .getByRole('button', { name: 'Enregistrer la dépense' })
      .click();

    await expect(window.getByText(/Dépense enregistrée —/)).toBeVisible();
    await expect(window.getByText(EXPENSE_DESC)).toBeVisible();
  });

  test('edits the expense in place', async () => {
    await window.getByRole('button', { name: 'Modifier' }).first().click();

    const description = window.locator('#expense-description');
    await expect(description).toHaveValue(EXPENSE_DESC);
    await description.fill(EXPENSE_DESC_EDITED);
    await window.locator('#expense-amount').fill('18000');
    await window.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(window.getByText(/Dépense mise à jour —/)).toBeVisible();
    await expect(window.getByText(EXPENSE_DESC_EDITED)).toBeVisible();
  });

  test('deletes the expense through the confirmation modal', async () => {
    await window.getByRole('button', { name: 'Supprimer' }).first().click();
    const dialog = window.getByLabel('Supprimer cette dépense ?');
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: 'Supprimer définitivement' })
      .click();

    await expect(window.getByText('Dépense supprimée.')).toBeVisible();
    await expect(window.getByText(EXPENSE_DESC_EDITED)).toBeHidden();
  });

  test('adds a staff member', async () => {
    await nav('Personnel').click();
    await window
      .getByRole('button', { name: 'Ajouter un membre du personnel' })
      .first()
      .click();

    await expect(window.locator('#staff-no')).not.toHaveValue('');
    await window.locator('#staff-full-name').fill(STAFF_NAME);
    await window.locator('#staff-role').fill('Enseignant');
    await window.locator('#staff-monthly-salary').fill('80000');

    // The form's submit button carries the same label as the toolbar action,
    // but the toolbar is not rendered while the form view is open.
    await window
      .getByRole('button', { name: 'Ajouter un membre du personnel' })
      .click();

    await expect(
      window.getByText('Membre du personnel ajouté.'),
    ).toBeVisible();
    await expect(window.getByText(STAFF_NAME)).toBeVisible();
  });

  test('edits the staff member personal data', async () => {
    await window.getByRole('button', { name: 'Modifier' }).first().click();

    const fullName = window.locator('#staff-full-name');
    await expect(fullName).toHaveValue(STAFF_NAME);
    await fullName.fill(STAFF_NAME_EDITED);
    await window.locator('#staff-role').fill('Directeur');
    await window.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(
      window.getByText('Fiche du personnel mise à jour.'),
    ).toBeVisible();
    await expect(window.getByText(STAFF_NAME_EDITED)).toBeVisible();
    await expect(
      window.getByRole('cell', { name: 'Directeur', exact: true }),
    ).toBeVisible();
  });
});
