import { FormEvent, useState } from 'react';
import type { UserDto } from '@bsafe/shared-types';
import { ShieldIcon } from '../components/icons';
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
      className="mt-6 max-w-md space-y-5 rounded-2xl border border-line bg-panel p-6"
    >
      <div>
        <span className="field-label">Account email</span>
        <p className="mt-1.5 font-mono text-sm text-mist">{profile.email ?? '…'}</p>
      </div>
      <div>
        <label htmlFor="name" className="field-label">
          Name
        </label>
        <input
          id="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
        />
      </div>
      <div>
        <label htmlFor="phone" className="field-label">
          Phone
        </label>
        <input
          id="phone"
          placeholder="+14155550123"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="field-input"
        />
      </div>

      {message && (
        <p
          className={`text-sm ${updateProfile.isError ? 'text-signal-soft' : 'text-safe-soft'}`}
          role="status"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || updateProfile.isPending}
        className="min-h-11 w-full rounded-xl bg-signal py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-bright disabled:opacity-50"
      >
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

export function ProfilePage() {
  const profile = useProfile();

  return (
    <div className="mx-auto max-w-xl animate-rise text-chalk">
      <header>
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Profile</h1>
      </header>

      {profile.isPending ? (
        <p className="mt-6 text-sm text-mist">Loading profile…</p>
      ) : profile.data ? (
        <>
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-panel p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-bright bg-raised font-display text-xl font-semibold text-chalk">
              {profile.data.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
                {profile.data.name}
                {profile.data.isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-caution/40 bg-caution/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-caution">
                    <ShieldIcon className="h-3 w-3" />
                    ADMIN
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-faint">
                {profile.data.email ?? '—'}
              </p>
            </div>
          </div>
          <ProfileForm key={profile.data.id} profile={profile.data} disabled={profile.isFetching} />
        </>
      ) : (
        <p className="mt-6 text-sm text-signal-soft">Could not load profile.</p>
      )}
    </div>
  );
}
