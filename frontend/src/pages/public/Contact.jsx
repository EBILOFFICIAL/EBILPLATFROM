import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CmsPage from './CmsPage';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import { publicService } from '../../services/jobService';
import { run } from '../../utils/formatters';

export default function Contact() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ type: params.get('type') || 'general' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await run(publicService.contact(form)); setForm({ type: 'general' }); } catch { /* shown */ } finally { setBusy(false); }
  };
  return (
    <CmsPage slug="contact">
      <form onSubmit={submit} data-testid="contact-form" className="card mt-10 grid gap-4 p-8 sm:grid-cols-2">
        <Field label="Name" name="name" value={form.name} onChange={set} required />
        <Field label="Work email" name="email" type="email" value={form.email} onChange={set} required />
        <Field label="Company" name="company" value={form.company} onChange={set} />
        <Field label="Topic" name="type" type="select" value={form.type} onChange={set} options={['general', 'demo', 'partnership', 'grievance']} />
        <div className="sm:col-span-2"><Field label="Message" name="message" type="textarea" rows={5} value={form.message} onChange={set} required /></div>
        <div className="sm:col-span-2"><Button type="submit" loading={busy} data-testid="contact-submit">Send message</Button></div>
      </form>
    </CmsPage>
  );
}
