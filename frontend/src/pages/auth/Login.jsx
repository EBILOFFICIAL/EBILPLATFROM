import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Field from '../../components/common/Field';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';
import { errorMessage } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { PORTALS, HOME_BY_ROLE } from '../../constants';

export const DevOtp = ({ code }) => (code ? <div data-testid="dev-otp" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">MOCK email mode — your code is <b className="font-mono text-sm">{code}</b></div> : null);

export default function Login() {
  const [params] = useSearchParams();
  const [portal, setPortal] = useState(params.get('portal') || 'employee');
  const [form, setForm] = useState({});
  const [twoFa, setTwoFa] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const finish = async (accessToken) => {
    const me = await signIn(accessToken);
    if (!me.emailVerified) return nav(`/verify-email?email=${encodeURIComponent(me.email)}`);
    return nav(params.get('next') || HOME_BY_ROLE[me.role]);
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (twoFa) await finish((await authService.verify2fa({ email: form.email, code: form.code })).accessToken);
      else {
        const r = await authService.login({ email: form.email, password: form.password, portal });
        if (r.data.twoFactorRequired) setTwoFa(r.data); else await finish(r.data.accessToken);
      }
    } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  };

  return (
    <div className="fade-up">
      <h1 className="text-3xl font-extrabold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-slate-500">Choose your portal to continue.</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {PORTALS.map((p) => (
          <button key={p.key} type="button" data-testid={`portal-${p.key}`} onClick={() => { setPortal(p.key); setTwoFa(null); }} className={`rounded-xl border p-3 text-left transition-colors ${portal === p.key ? 'border-brand bg-brand-light' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className={`text-sm font-bold ${portal === p.key ? 'text-brand' : 'text-ink'}`}>{p.label}</div>
            <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{p.desc}</div>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4" data-testid="login-form">
        {!twoFa ? (<>
          <Field label="Email" name="email" type="email" value={form.email} onChange={set} required testId="login-email" />
          <Field label="Password" name="password" type="password" value={form.password} onChange={set} required testId="login-password" />
        </>) : (<>
          <p className="text-sm text-slate-600">Two-factor sign-in: enter the 6-digit code sent to <b>{twoFa.email}</b>.</p>
          <DevOtp code={twoFa.devOtp} />
          <Field label="Sign-in code" name="code" value={form.code} onChange={set} required maxLength={6} testId="login-2fa-code" />
        </>)}
        {err && <p data-testid="login-error" className="text-sm font-medium text-brand">{err}</p>}
        <Button type="submit" loading={busy} className="w-full" data-testid="login-submit">{twoFa ? 'Verify & sign in' : `Sign in to ${portal} portal`}</Button>
      </form>
      <div className="mt-6 flex justify-between text-sm"><Link to="/forgot-password" className="text-slate-500 hover:text-brand" data-testid="forgot-link">Forgot password?</Link><Link to="/register" className="font-semibold text-brand" data-testid="register-link">Create account</Link></div>
    </div>
  );
}
