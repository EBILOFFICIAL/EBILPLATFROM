import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import { DevOtp } from './Login';
import { authService } from '../../services/authService';
import { errorMessage } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { HOME_BY_ROLE } from '../../constants';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [code, setCode] = useState('');
  const [dev, setDev] = useState(params.get('dev'));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      await authService.verifyEmail({ email, code });
      if (user) { const me = await refresh(); nav(HOME_BY_ROLE[me.role]); } else nav('/login?verified=1');
    } catch (ex) { setMsg(errorMessage(ex)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try { const r = await authService.resendOtp({ email }); setDev(r.data?.devOtp); setMsg('A new code was sent.'); } catch (ex) { setMsg(errorMessage(ex)); }
  };
  return (
    <div className="fade-up">
      <h1 className="text-3xl font-extrabold text-ink">Verify your email</h1>
      <p className="mt-2 text-sm text-slate-500">Enter the 6-digit code sent to <b>{email}</b>. It expires in 10 minutes; 5 attempts allowed.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <DevOtp code={dev} />
        <Field label="Verification code" name="code" value={code} onChange={(_, v) => setCode(v)} maxLength={6} required testId="verify-email-code" />
        {msg && <p data-testid="verify-email-message" className="text-sm text-brand">{msg}</p>}
        <Button type="submit" loading={busy} className="w-full" data-testid="verify-email-submit">Verify email</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm"><button onClick={resend} data-testid="resend-otp" className="font-semibold text-brand">Resend code</button><Link to="/login" className="text-slate-500">Back to sign in</Link></div>
    </div>
  );
}
