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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-red-500';

function LabeledInput({ id, label, ...rest }: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <input id={id} className={inputClass} {...rest} />
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      relationship: relationship.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <LabeledInput id="contact-name" label="Name" required maxLength={120} value={name}
        onChange={(e) => setName(e.target.value)} />
      <LabeledInput id="contact-phone" label="Phone" placeholder="e.g. +14155550123" value={phone}
        onChange={(e) => setPhone(e.target.value)} />
      <LabeledInput id="contact-email" label="Email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <LabeledInput id="contact-relationship" label="Relationship (optional)" maxLength={80} value={relationship}
        onChange={(e) => setRelationship(e.target.value)} />
      <button
        type="submit"
        disabled={mutating}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
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
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-red-500">
        <UsersIcon className="h-6 w-6" />
        Emergency contacts
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        {count}/{MAX_CONTACTS}. At least one contact is required before SOS is enabled.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          {isPending ? (
            <p className="text-sm text-slate-400">Loading contacts…</p>
          ) : isError ? (
            <p className="text-sm text-red-400">Could not load contacts.</p>
          ) : contacts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <UsersIcon className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">No contacts yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Add your first emergency contact on the right to enable SOS.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3 text-slate-500" />
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1">
                          <MailIcon className="h-3 w-3 text-slate-500" />
                          {c.email}
                        </span>
                      )}
                      {c.relationship && (
                        <span className="text-slate-500">{c.relationship}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-sm">
                    <button
                      onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 transition-colors hover:border-red-500 hover:text-red-400"
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
                      className="flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-red-400 transition-colors hover:border-red-500 disabled:opacity-60"
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

        <aside className="h-fit rounded-xl border border-slate-800 bg-slate-900 p-4">
          {editing ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">Edit {editing.name}</h2>
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
              <h2 className="mb-3 text-lg font-semibold">Add a contact</h2>
              {count >= MAX_CONTACTS ? (
                <p className="text-sm text-amber-300">You&apos;ve reached the 5-contact limit.</p>
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