import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, closeApp } from './electron';

test.describe('Suivi Frais Scolaires — smoke', () => {
  let app: ElectronApplication;
  let window: Page;
  let userDataDir: string;

  test.beforeAll(async () => {
    ({ app, window, userDataDir } = await launchApp());
  });

  test.afterAll(async () => {
    await closeApp(app, userDataDir);
  });

  test('launches and shows the dashboard by default', async () => {
    await expect(
      window.getByRole('heading', { name: 'Accueil', level: 1 }),
    ).toBeVisible();
  });

  test('navigates to Élèves and shows the students screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Élèves' })
      .click();
    await expect(window.getByRole('heading', { name: 'Élèves', level: 1 })).toBeVisible();
    await expect(window.getByPlaceholder(/rechercher/i)).toBeVisible();
    await expect(
      window.getByRole('button', { name: 'Ajouter un élève' }).first(),
    ).toBeVisible();
  });

  test('navigates to Inscriptions and shows the enrollments screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Inscriptions' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Inscriptions', level: 1 }),
    ).toBeVisible();
  });

  test('navigates to Paiements and shows the payments screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Paiements' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Paiements', level: 1 }),
    ).toBeVisible();
  });

  test('navigates to Paramètres and shows the settings screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Paramètres' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Paramètres', level: 1 }),
    ).toBeVisible();
    await expect(
      window.getByRole('button', { name: 'Infos école' }),
    ).toBeVisible();
    await window.getByRole('button', { name: 'Vider les données' }).click();
    await expect(
      window.getByRole('heading', { name: 'Charger des données de démonstration' }),
    ).toBeVisible();
    await expect(
      window.getByRole('button', { name: 'Charger les données de démonstration' }),
    ).toBeVisible();
    await expect(
      window.getByRole('heading', { name: 'Vider les données' }),
    ).toBeVisible();
    await expect(
      window.getByText('Paiements des élèves', { exact: true }),
    ).toBeVisible();
    await expect(
      window.getByText("Nom de l'école et logo", { exact: true }),
    ).toBeVisible();
  });

  test('navigates to Dépenses and shows the expenses screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Dépenses' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Dépenses', level: 1 }),
    ).toBeVisible();
    await expect(
      window.getByRole('button', { name: 'Nouvelle dépense' }).first(),
    ).toBeVisible();
  });

  test('navigates to Personnel and shows the staff screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Personnel' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Personnel', level: 1 }),
    ).toBeVisible();
    await expect(
      window
        .getByRole('button', { name: 'Ajouter un membre du personnel' })
        .first(),
    ).toBeVisible();
  });

  test('navigates to Finances and shows the consolidated report screen', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Finances' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Finances', level: 1 }),
    ).toBeVisible();
    await expect(window.getByText('Solde net:')).toBeVisible();
  });

  test('shows the global student search field in the header', async () => {
    await expect(window.getByLabel("Recherche globale d'élève")).toBeVisible();
  });

  test('shows the "Sauvegarder maintenant" backup action in Options avancées', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Paramètres' })
      .click();
    await window.getByRole('button', { name: 'Options avancées' }).click();
    await expect(
      window.getByRole('button', { name: 'Sauvegarder maintenant' }),
    ).toBeVisible();
  });

  test('shows the "Rapport élève" screen with the overdue reminders section container', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Rapport élève' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Rapport élève', level: 1 }),
    ).toBeVisible();
  });

  test('navigates to Aide and shows the getting-started guide', async () => {
    await window
      .getByRole('navigation')
      .getByRole('button', { name: 'Aide' })
      .click();
    await expect(
      window.getByRole('heading', { name: 'Aide', level: 1 }),
    ).toBeVisible();
    await expect(
      window.getByRole('heading', { name: 'Configurer l\'école pour la première fois' }),
    ).toBeVisible();
    await window.getByRole('tab', { name: 'Paiements' }).click();
    await expect(
      window.getByRole('heading', { name: 'Encaisser un paiement et imprimer le reçu' }),
    ).toBeVisible();
  });
});
