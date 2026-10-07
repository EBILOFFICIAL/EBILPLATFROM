import { useEffect, useState } from 'react';
import Modal from './Modal';
import Field from './Field';
import Button from './Button';

export default function FormModal({ open, onClose, title, fields, initial = {}, onSubmit, submitLabel = 'Save', testId = 'form-modal', children }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setForm(initial); }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(form); onClose(); } catch { /* toast shown */ } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} testId={testId} wide={fields.length > 6}>
      <form onSubmit={submit} className="space-y-4">
        <div className={`grid gap-4 ${fields.length > 6 ? 'sm:grid-cols-2' : ''}`}>
          {fields.map((f) => <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}><Field {...f} value={form[f.name]} onChange={set} testId={`${testId}-${f.name}`} /></div>)}
        </div>
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} data-testid={`${testId}-submit`}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
