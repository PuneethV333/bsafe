import { FormEvent, useState } from 'react';
import type { UserDto } from '@bsafe/shared-types';
import { UserIcon } from '../components/icons';
import { useProfile, useUpdateProfile } from '../lib/users';

function ProfileForm({ profile, disabled }: { profile: UserDto; disabled: boolean }) {
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await updateProfile.mutateAsync({ name, phone: phone.trim() || null });
      setMessage('Profile updated.');
    } catch (err) {
      const { response } = err as { response?: { data?: { message?: string | string[] } } };
      const m = response?.data?.message;
      setMessage(Array.isArray(m) ? m.join(', ') : (m ?? 'Update failed.'));
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
    >
      <div>
        <label className="block text-xs uppercase tracking-wide text-slate-400">Firebase email</label>
        <p className="mt-1 text-sm">{profile.email ?? '…'}</p>
      </div>
      <div>
        <label htmlFor="name" className="block text-xs uppercase tracking-wide text-slate-400">
          Name
        </label>
        <input
          id="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-xs uppercase tracking-wide text-slate-400">
          Phone
        </label>
        <input
          id="phone"
          placeholder="e.g. +14155550123"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
        />
      </div>

      {message && (
        <p className={updateProfile.isError ? 'text-sm text-red-400' : 'text-sm text-emerald-300'}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || updateProfile.isPending}
        className="w-full min-h-11 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
      >
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

export function ProfilePage() {
  const profile = useProfile();

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-red-500">
        <UserIcon className="h-6 w-6" />
        Profile
      </h1>
      {profile.isPending ? (
        <p className="mt-6 text-sm text-slate-400">Loading profile…</p>
      ) : profile.data ? (
        <ProfileForm key={profile.data.id} profile={profile.data} disabled={profile.isFetching} />
      ) : (
        <p className="mt-6 text-sm text-red-400">Could not load profile.</p>
      )}
    </div>
  );
}