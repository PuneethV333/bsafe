import { Link } from 'react-router-dom';
import type { UserDto } from '@bsafe/shared-types';
import { SosPanel } from '../components/SosPanel';
import { useContacts } from '../lib/contacts';
import { useProfile } from '../lib/users';
import { useAuth } from '../lib/useAuth';

export function HomePage() {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const contacts = useContacts();

  const count = contacts.data?.length ?? 0;

  const display = (p?: UserDto) =>
    p ? (
      <>
        <b>{p.name}</b> <span className="text-slate-400">({p.email ?? 'no email'})</span>
      </>
    ) : (
      '…'
    );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 flex-col justify-between border-r border-slate-800 p-4">
        <div>
          <h1 className="text-2xl font-bold text-red-500">bSafe</h1>
          <p className="mt-2 text-sm text-slate-300">{display(profile.data)}</p>
          {profile.isError && (
            <p className="mt-2 text-xs text-amber-300">
              Profile sync failed — verify Firebase credentials and that the API can reach them.
            </p>
          )}
        </div>
        <nav className="space-y-1 text-sm">
          <Link to="/" className="block rounded px-3 py-1.5 text-slate-200 hover:bg-slate-800">
            Home
          </Link>
          <Link to="/contacts" className="block rounded px-3 py-1.5 text-slate-200 hover:bg-slate-800">
            Emergency contacts ({contacts.data ? count : '…'})
          </Link>
          <Link to="/me" className="block rounded px-3 py-1.5 text-slate-200 hover:bg-slate-800">
            Profile
          </Link>
        </nav>
        <button
          onClick={() => signOut()}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-red-500 hover:text-red-400"
        >
          <span className="sr-only">{user?.email}</span> Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold">SOS</h2>
        <SosPanel />
      </main>
    </div>
  );
}