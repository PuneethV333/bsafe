import { FormEvent, useState } from 'react';
import type { EmergencyContactDto } from '@bsafe/shared-types';
import {
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
  type ContactInput,
} from '../lib/contacts';
import { MailIcon, PencilIcon, PhoneIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';

const MAX_CONTACTS = 5;

function errMessage(e: unknown): string {
  const { response } = e as { response?: { data?: { message?: string | string[] } } };
  const m = response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed.');
}

const PHONE_RE = /^\+[1-9]\d{7,14}$/;

function LabeledInput({ id, label, ...rest }: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} className="field-input" {...rest} />
    </div>
  );
}

function ContactForm({ initial, onSubmit, submitLabel, mutating }: {
  initial?: EmergencyContactDto;
  onSubmit: (input: ContactInput) => void;
  submitLabel: string;
  mutating: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [relationship, setRelationship] = useState(initial?.relationship ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (!PHONE_RE.test(trimmedPhone)) {
      setPhoneError('Phone must include country code, e.g. +919876543210');
      return;
    }
    setPhoneError(null);
    onSubmit({
      name,
      phone: trimmedPhone,
      email: email.trim() || undefined,
      relationship: relationship.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <LabeledInput id="contact-name" label="Name" required maxLength={120} value={name}
        onChange={(e) => setName(e.target.value)} />
      <LabeledInput id="contact-phone" label="Phone" required placeholder="+14155550123" value={phone}
        onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }} />
      {phoneError && (
        <p role="alert" className="text-xs text-signal-soft">{phoneError}</p>
      )}
      <LabeledInput id="contact-email" label="Email (optional)" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <LabeledInput id="contact-relationship" label="Relationship (optional)" maxLength={80} value={relationship}
        onChange={(e) => setRelationship(e.target.value)} />
      <button
        type="submit"
        disabled={mutating}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-bright disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4" />
        {submitLabel}
      </button>
    </form>
  );
}

export function ContactsPage() {
  const { data: contacts, isPending, isError } = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const editing = contacts?.find((c) => c.id === editingId);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setMutating(true);
    try {
      await fn();
      setEditingId(null);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setMutating(false);
    }
  };

  const count = contacts?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl animate-rise text-chalk">
      <header>
        <p className="eyebrow">Your people</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Emergency contacts</h1>
        <p className="mt-2 text-sm text-mist">
          At least one contact is required before SOS is enabled.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: MAX_CONTACTS }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full ${i < count ? 'bg-safe' : 'bg-line'}`}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-mist">
            {count}/{MAX_CONTACTS} SLOTS
          </span>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm text-signal-soft">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          {isPending ? (
            <p className="text-sm text-mist">Loading contacts…</p>
          ) : isError ? (
            <p className="text-sm text-signal-soft">Could not load contacts.</p>
          ) : contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center">
              <UsersIcon className="mx-auto h-8 w-8 text-faint" />
              <p className="mt-3 text-sm font-medium text-chalk">No contacts yet</p>
              <p className="mt-1 text-sm text-mist">
                Add your first emergency contact to enable SOS.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
                    editingId === c.id
                      ? 'border-signal/50 bg-signal/5'
                      : 'border-line bg-panel hover:border-line-bright'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-display text-base font-semibold text-mist">
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-chalk">{c.name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-mist">
                        {c.phone && (
                          <span className="inline-flex items-center gap-1">
                            <PhoneIcon className="h-3 w-3 text-faint" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MailIcon className="h-3 w-3 shrink-0 text-faint" />
                            {c.email}
                          </span>
                        )}
                        {c.relationship && (
                          <span className="text-faint">{c.relationship}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist transition-colors hover:border-line-bright hover:text-chalk"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      {editingId === c.id ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      disabled={mutating}
                      onClick={() =>
                        run(async () => {
                          await deleteContact.mutateAsync(c.id);
                        })
                      }
                      className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-signal-soft transition-colors hover:border-signal/60 hover:bg-signal/10 disabled:opacity-60"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-line bg-panel p-5 lg:sticky lg:top-6">
          {editing ? (
            <>
              <h2 className="mb-4 font-display text-lg font-semibold text-chalk">
                Edit {editing.name}
              </h2>
              <ContactForm
                initial={editing}
                mutating={mutating}
                submitLabel={mutating ? 'Saving…' : 'Save changes'}
                onSubmit={(input) =>
                  run(async () => {
                    await updateContact.mutateAsync({ id: editing.id, ...input });
                  })
                }
              />
            </>
          ) : (
            <>
              <h2 className="mb-4 font-display text-lg font-semibold text-chalk">Add a contact</h2>
              {count >= MAX_CONTACTS ? (
                <p className="text-sm leading-relaxed text-caution">
                  You&apos;ve reached the 5-contact limit. Remove one to add another.
                </p>
              ) : (
                <ContactForm
                  mutating={mutating}
                  submitLabel={mutating ? 'Adding…' : 'Add contact'}
                  onSubmit={(input) =>
                    run(async () => {
                      await createContact.mutateAsync(input);
                    })
                  }
                />
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
