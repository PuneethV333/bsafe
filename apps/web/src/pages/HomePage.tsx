import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@bsafe/shared-types';
import { apiClient } from '../lib/apiClient';
import { auth } from '../lib/firebase';
import { useProfile } from '../lib/profile';
import { useAuth } from '../lib/useAuth';

export function HomePage() {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const { data: contactsCount } = useQuery<number>({
    queryKey: ['contacts', 'count'],
    enabled: Boolean(profile.data),
    queryFn: async () => {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) throw new Error('Not authenticated');
      const res = await apiClient.get('/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Array.isArray(res.data) ? res.data.length : 0;
    },
  });

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
        <p className="text-xs text-slate-500">
          {contactsCount === undefined ? 'Loading contacts…' : `${contactsCount} contact(s)`}
        </p>
        <button
          onClick={() => signOut()}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-red-500 hover:text-red-400"
        >
          <span className="sr-only">{user?.email}</span> Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-400">
          Phase 2 is in: Firebase auth is wired end to end. SOS trigger surface arrives in Phase 5.
        </p>
      </main>
    </div>
  );
}