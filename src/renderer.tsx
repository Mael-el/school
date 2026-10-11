import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import i18n from './i18n';
import { syncDocumentLanguage } from './lib/dates';
import './index.css';
import {
  createWebUser,
  disableWebUser,
  installWebApi,
  listWebUsers,
  loginWebUser,
  logoutWebUser,
  readCurrentWebUser,
  type WebUser,
  type WebUserRecord,
} from './web-api';

function PwaRoot() {
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [users, setUsers] = useState<WebUserRecord[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff'>('staff');

  const updateUser = (nextUser: WebUser | null) => {
    window.webUserRole = nextUser?.role;
    setUser(nextUser);
  };

  useEffect(() => {
    void readCurrentWebUser()
      .then(updateUser)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : 'Serveur indisponible.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => updateUser(null);
    window.addEventListener('web-auth-expired', handleSessionExpired);
    return () =>
      window.removeEventListener('web-auth-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin' || !showUsers) return;
    void listWebUsers()
      .then(setUsers)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger les comptes.',
        );
      });
  }, [showUsers, user]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      updateUser(await loginWebUser(username, password));
      setPassword('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Échec de connexion.',
      );
    }
  };

  const signOut = async () => {
    await logoutWebUser();
    updateUser(null);
    setShowUsers(false);
  };

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await createWebUser(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setUsers(await listWebUsers());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de créer le compte.',
      );
    }
  };

  const disableAccount = async (account: WebUserRecord) => {
    if (!window.confirm(`Désactiver le compte « ${account.username} » ?`))
      return;
    setError('');
    try {
      await disableWebUser(account.id);
      setUsers(await listWebUsers());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de désactiver le compte.',
      );
    }
  };

  if (loading) {
    return <main className="p-8 text-slate-600">Connexion au serveur…</main>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <form
          onSubmit={(event) => void signIn(event)}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-2xl font-semibold">Suivi des frais scolaires</h1>
          <p className="mt-2 text-slate-600">
            Connectez-vous au serveur sécurisé de votre établissement.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          )}
          <label className="mt-6 block text-sm font-medium">
            Nom d’utilisateur
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-slate-800 px-4 py-2 font-medium text-white"
          >
            Se connecter
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="fixed right-2 top-2 z-[100] flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border border-white/15 bg-[#1c0b30]/90 p-1.5 text-xs text-white shadow sm:right-4 sm:top-3 sm:gap-2 sm:p-2 sm:text-sm">
        <span>{user.username}</span>
        {user.role === 'admin' && (
          <button
            type="button"
            className="rounded border border-white/20 px-2 py-1"
            onClick={() => setShowUsers((value) => !value)}
          >
            Comptes
          </button>
        )}
        <button
          type="button"
          className="rounded border border-white/20 px-2 py-1"
          onClick={() => void signOut()}
        >
          Déconnexion
        </button>
      </div>
      {showUsers && user.role === 'admin' && (
        <aside className="fixed right-4 top-16 z-[100] w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <h2 className="font-semibold">Comptes utilisateurs</h2>
          <ul className="my-3 max-h-32 overflow-auto text-sm">
            {users.map((account) => (
              <li key={account.id} className="flex justify-between py-1">
                <span>
                  {account.username}{' '}
                  <span className="text-slate-500">{account.role}</span>
                </span>
                {account.id !== user.id && !account.disabled && (
                  <button
                    type="button"
                    className="text-red-700"
                    onClick={() => void disableAccount(account)}
                  >
                    Désactiver
                  </button>
                )}
                {account.disabled && (
                  <span className="text-slate-500">Désactivé</span>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={(event) => void addUser(event)} className="space-y-2">
            <input
              aria-label="Nom du nouveau compte"
              autoComplete="off"
              required
              minLength={3}
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="Nom d’utilisateur"
              className="w-full rounded border px-2 py-1.5"
            />
            <input
              aria-label="Mot de passe du nouveau compte"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Mot de passe (12 caractères min.)"
              className="w-full rounded border px-2 py-1.5"
            />
            <select
              aria-label="Rôle du nouveau compte"
              value={newRole}
              onChange={(event) =>
                setNewRole(event.target.value === 'admin' ? 'admin' : 'staff')
              }
              className="w-full rounded border px-2 py-1.5"
            >
              <option value="staff">Personnel</option>
              <option value="admin">Administrateur</option>
            </select>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded bg-slate-800 px-3 py-2 text-white"
            >
              Créer le compte
            </button>
          </form>
        </aside>
      )}
      <App />
    </>
  );
}

syncDocumentLanguage();
i18n.on('languageChanged', syncDocumentLanguage);

const isElectron = Reflect.has(window, 'api');
if (!isElectron) installWebApi();

if (!isElectron && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/service-worker.js')
      .catch((error: unknown) =>
        console.error('Service worker registration failed:', error),
      );
  });
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    {isElectron ? (
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    ) : (
      <I18nextProvider i18n={i18n}>
        <PwaRoot />
      </I18nextProvider>
    )}
  </StrictMode>,
);
