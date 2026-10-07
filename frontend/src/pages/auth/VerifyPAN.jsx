import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import { authService } from '../../services/authService';
import { errorMessage } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { isIndividualPan } from '../../utils/validators';

export default function VerifyPAN() {
  const { user, refresh } = useAuth();
  const p = user?.profile;
  const [form, setForm] = useState({ name: p?.fullName });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: k === 'pan' ? v.toUpperCase() : v }));
  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    if (!isIndividualPan(form.pan)) { setMsg('Enter a valid individual PAN (format ABCDE1234F, 4th letter P)'); return; }
    setBusy(true);
    try { const r = await authService.verifyPan(form); setMsg(r.data.panStatus === 'verified' ? 'PAN verified! Your EIBIL score is now active.' : 'Name mismatch: sent to our verification team for manual review.'); await refresh(); } catch (ex) { setMsg(errorMessage(ex)); } finally { setBusy(false); }
  };
  if (p?.panVerified) return <div data-testid="pan-verified" className="flex items-center gap-3 text-sm"><ShieldCheck className="h-5 w-5 text-emerald-600" />PAN <b className="font-mono">{p.panMasked}</b> verified <StatusBadge status="verified" /></div>;
  if (p?.panStatus === 'pending_review') return <div data-testid="pan-pending" className="text-sm text-slate-600">PAN <b className="font-mono">{p.panMasked}</b> is under manual review <StatusBadge status="pending_review" /></div>;
  return (
    <form onSubmit={submit} data-testid="pan-form" className="grid gap-4 sm:grid-cols-3">
      <Field label="PAN" name="pan" value={form.pan} onChange={set} required maxLength={10} placeholder="ABCDE1234F" testId="pan-input" />
      <Field label="Name as on PAN" name="name" value={form.name} onChange={set} required testId="pan-name" />
      <Field label="Date of birth" name="dob" type="date" value={form.dob} onChange={set} required testId="pan-dob" />
      <div className="sm:col-span-3"><Field type="checkbox" name="consent" value={form.consent} onChange={set} testId="pan-consent" label="I consent to EIBIL verifying my PAN with a licensed KYC provider (consent text v1.0). My PAN is stored encrypted and shown only masked." /></div>
      {msg && <p data-testid="pan-message" className="text-sm font-medium text-brand sm:col-span-3">{msg}</p>}
      <div className="sm:col-span-3 flex items-center gap-3"><Button type="submit" loading={busy} disabled={!form.consent} data-testid="pan-submit"><Lock className="h-4 w-4" />Verify PAN</Button><span className="text-xs text-slate-400">One PAN = one EIBIL profile. Duplicates are blocked.</span></div>
    </form>
  );
}
