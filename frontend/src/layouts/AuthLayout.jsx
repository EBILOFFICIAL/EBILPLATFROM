import { Link, Outlet } from 'react-router-dom';
import { ShieldCheck, Lock, Fingerprint } from 'lucide-react';
import Logo from '../components/common/Logo';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <Link to="/" className="relative inline-flex w-fit rounded-xl bg-white px-4 py-2"><Logo className="h-8" /></Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight">Your career,<br />verified and portable.</h2>
          <p className="mt-4 max-w-md text-slate-300">One PAN, one profile. Every employment record and evaluation sealed in a hash-chained ledger you can always see, rebut and dispute.</p>
          <div className="mt-10 space-y-4 text-sm text-slate-300">
            {[[ShieldCheck, 'Transparent reports. You are notified every time an employer views your score.'], [Lock, 'PAN encrypted with AES-256-GCM. Only masked PAN is ever shown.'], [Fingerprint, 'Email OTP mandatory. Admins protected with 2FA.']].map(([I, t]) => <div key={t} className="flex items-center gap-3"><I className="h-5 w-5 text-brand" />{t}</div>)}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Employment Integrity & Background Intelligence League</p>
      </div>
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12">
        <div className="w-full max-w-md"><div className="mb-8 lg:hidden"><Link to="/"><Logo className="h-8" /></Link></div><Outlet /></div>
      </div>
    </div>
  );
}
