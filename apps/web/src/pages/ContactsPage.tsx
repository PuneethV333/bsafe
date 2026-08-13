import { FormEvent, useState } from 'react';
import type { EmergencyContactDto } from '@bsafe/shared-types';
import {
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
  type ContactInput,
} from '../lib/contacts';

const MAX_CONTACTS = 5;

function errMessage(e: unknown): string {
  const { response } = e as { response?: { data?: { message?: string | string[] } } };
  const m = response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed.');
}

function ContactForm({ initial, onSubmit, submitLabel }: {
  initial?: EmergencyContactDto;
  onSubmit: (input: ContactInput) => void;
  submitLabel: string;
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
      <input
        required
        maxLength={120}
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
      <input
        placeholder="Phone (e.g. +14155550123)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
      <input
        maxLength={80}
        placeholder="Relationship (optional)"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500"
      >
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
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <h1 className="text-2xl font-bold text-red-500">Emergency contacts</h1>
      <p className="mt-1 text-sm text-slate-400">
        {count}/{MAX_CONTACTS}. At least one contact is required before SOS is enabled.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
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
            <p className="text-sm text-slate-400">No contacts yet — add your first one.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.phone && <span className="mr-2">{c.phone}</span>}
                      {c.email && <span className="mr-2">{c.email}</span>}
                      {c.relationship && <span className="text-slate-500">{c.relationship}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                      className="rounded border border-slate-700 px-3 py-1 hover:border-red-500 hover:text-red-400"
                    >
                      {editingId === c.id ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      disabled={mutating}
                      onClick={() =>
                        run(async () => {
                          await deleteContact.mutateAsync(c.id);
                        })
                      }
                      className="rounded border border-slate-700 px-3 py-1 text-red-400 hover:border-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          {editing ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">Edit {editing.name}</h2>
              <ContactForm
                initial={editing}
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