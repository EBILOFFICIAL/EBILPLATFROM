import { useState } from 'react';
import { Link } from 'react-router-dom';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import { DevOtp } from './Login';
import { authService } from '../../services/authService';
import { run } from '../../utils/formatters';

export default function ForgotPassword() {
  const [form, setForm] = useState({});
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (!sent) setSent((await run(authService.forgot({ email: form.email }))).data || {});
      else { await run(authService.reset(form)); setSent('done'); }
    } catch { /* shown */ } finally { setBusy(false); }
  };
  if (sent === 'done') return <div><h1 className="text-2xl font-bold text-ink">Password updated</h1><Link to="/login" className="btn-primary mt-6">Sign in</Link></div>;
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-extrabold text-ink">Reset password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" value={form.email} onChange={set} required testId="forgot-email" />
        {sent && (<><DevOtp code={sent.devOtp} /><Field label="Reset code" name="code" value={form.code} onChange={set} required testId="forgot-code" /><Field label="New password" name="password" type="password" value={form.password} onChange={set} required testId="forgot-password" /></>)}
        <Button type="submit" loading={busy} className="w-full" data-testid="forgot-submit">{sent ? 'Set new password' : 'Send reset code'}</Button>
      </form>
    </div>
  );
}
