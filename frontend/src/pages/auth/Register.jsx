import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import { Tabs } from '../../components/common/Layout';
import { authService } from '../../services/authService';
import { errorMessage } from '../../services/api';

const EMPLOYEE = [['name', 'Full name (as on PAN)'], ['email', 'Email', 'email'], ['mobile', 'Mobile (+91…)'], ['password', 'Password', 'password']];
const EMPLOYER = [['companyName', 'Company name'], ['gstin', 'GSTIN'], ['cin', 'CIN (optional if GSTIN given)'], ['hrContactName', 'HR contact name'], ['email', 'Official work email', 'email'], ['phone', 'Phone (+91…)'], ['city', 'City'], ['password', 'Password', 'password']];

export default function Register() {
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'employer' ? 'employer' : 'employee');
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const fields = role === 'employer' ? EMPLOYER : EMPLOYEE;
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await authService.register(role, form);
      nav(`/verify-email?email=${encodeURIComponent(form.email)}${r.data.otp?.devOtp ? `&dev=${r.data.otp.devOtp}` : ''}`);
    } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-extrabold text-ink">Create your EIBIL account</h1>
      <p className="mb-6 mt-2 text-sm text-slate-500">Email verification is mandatory for every account.</p>
      <Tabs tabs={[{ value: 'employee', label: 'Professional' }, { value: 'employer', label: 'Employer' }]} value={role} onChange={(r) => { setRole(r); setForm({}); }} />
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid="register-form">
        {fields.map(([n, l, t]) => <div key={n} className={n === 'password' || n === 'name' || n === 'companyName' ? 'sm:col-span-2' : ''}><Field label={l} name={n} type={t || 'text'} value={form[n]} onChange={set} required={!['cin', 'city', 'gstin'].includes(n)} testId={`register-${n}`} hint={n === 'password' ? '8+ characters with letters and numbers' : n === 'email' && role === 'employer' ? 'Free email domains (gmail, yahoo…) are blocked' : undefined} /></div>)}
        {err && <p data-testid="register-error" className="text-sm font-medium text-brand sm:col-span-2">{err}</p>}
        <Button type="submit" loading={busy} className="sm:col-span-2" data-testid="register-submit">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link></p>
    </div>
  );
}
