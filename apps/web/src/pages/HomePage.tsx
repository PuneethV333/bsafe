import { NavLink } from 'react-router-dom';
import type { UserDto } from '@bsafe/shared-types';
import { SosPanel } from '../components/SosPanel';
import { HomeIcon, LogOutIcon, ShieldIcon, UserIcon, UsersIcon } from '../components/icons';
import { useContacts } from '../lib/contacts';
import { useProfile } from '../lib/users';
import { useAuth } from '../lib/useAuth';

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-slate-800 text-white'
      : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100',
  ].join(' ');
}

export function HomePage() {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const contacts = useContacts();

  const count = contacts.data?.length ?? 0;

  const display = (p?: UserDto) =>
    p ? (
      <>
        <b className="truncate">{p.name}</b>
      </>
    ) : (
      '…'
    );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <aside className="flex w-full flex-col gap-4 border-b border-slate-800 p-4 lg:w-64 lg:justify-between lg:gap-0 lg:border-b-0 lg:border-r">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
              <HomeIcon className="h-4 w-4 text-white" />
            </span>
            <h1 className="text-2xl font-bold text-red-500">bSafe</h1>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-300">
            <UserIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            {display(profile.data)}
          </p>
          {profile.isError && (
            <p className="mt-2 text-xs text-amber-300">
              Profile sync failed — verify Firebase credentials and that the API can reach them.
            </p>
          )}
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:gap-0 lg:space-y-1">
          <NavLink to="/" end className={navClass}>
            <HomeIcon className="h-4 w-4 shrink-0" />
            Home
          </NavLink>
          <NavLink to="/contacts" className={navClass}>
            <UsersIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1">Emergency contacts</span>
            <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-xs font-semibold text-slate-200">
              {contacts.data ? count : '…'}
            </span>
          </NavLink>
          <NavLink to="/me" className={navClass}>
            <UserIcon className="h-4 w-4 shrink-0" />
            Profile
          </NavLink>
          {profile.data?.isAdmin && (
            <NavLink to="/admin" className={navClass}>
              <ShieldIcon className="h-4 w-4 shrink-0" />
              Admin
            </NavLink>
          )}
        </nav>
        <button
          onClick={() => signOut()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-red-500 hover:text-red-400"
        >
          <LogOutIcon className="h-4 w-4" />
          <span className="sr-only">{user?.email}</span> Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <h2 className="text-xl font-semibold">SOS</h2>
        <SosPanel />
      </main>
    </div>
  );
}