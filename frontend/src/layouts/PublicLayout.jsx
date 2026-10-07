import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, ShieldCheck } from 'lucide-react';
import Logo from '../components/common/Logo';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/usePagination';
import { publicService } from '../services/jobService';
import { HOME_BY_ROLE } from '../constants';

const NAV = [['/platform', 'Platform'], ['/score-system', 'Score System'], ['/how-it-works', 'How It Works'], ['/jobs', 'Jobs'], ['/verify', 'Verify Report'], ['/pricing', 'Pricing'], ['/about', 'About']];
const FOOT = [
  ['Platform', [['/platform', 'Platform'], ['/score-system', 'Score System'], ['/how-it-works', 'How It Works'], ['/jobs', 'Jobs'], ['/verify', 'Verify Report'], ['/pricing', 'Pricing']]],
  ['Company', [['/about', 'About Us'], ['/csr', 'CSR'], ['/contact', 'Contact Us'], ['/faq', 'FAQ']]],
  ['Trust', [['/privacy', 'Privacy Policy'], ['/terms', 'Terms'], ['/security', 'Security'], ['/compliance', 'Compliance']]],
  ['Portals', [['/login?portal=employee', 'Employee Login'], ['/login?portal=employer', 'Employer Login'], ['/login?portal=admin', 'Admin Login'], ['/register', 'Register']]],
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" data-testid="nav-home"><Logo className="h-8" /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map(([to, l]) => <NavLink key={to} to={to} data-testid={`nav-${to.slice(1)}`} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-brand' : 'text-slate-600 hover:text-ink'}`}>{l}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? <Link to={HOME_BY_ROLE[user.role]} className="btn-primary" data-testid="nav-dashboard">Go to dashboard</Link> : (<>
            <Link to="/login" className="btn-ghost" data-testid="nav-login">Login</Link>
            <Link to="/register" className="btn-primary" data-testid="nav-check-score">Check your score</Link>
          </>)}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden">
          {NAV.map(([to, l]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-slate-700">{l}</Link>)}
          <div className="mt-3 flex gap-2"><Link to="/login" className="btn-secondary flex-1">Login</Link><Link to="/register" className="btn-primary flex-1">Register</Link></div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-6 lg:px-8">
        <div className="lg:col-span-2">
          <Logo className="h-9" />
          <p className="mt-4 max-w-xs text-sm text-slate-500">India&apos;s employment score bureau. Verified, transparent, tamper-evident career records.</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" />DPDP Act 2023 aligned · ISO 27001 in progress (not certified)</p>
        </div>
        {FOOT.map(([h, links]) => (
          <div key={h}>
            <div className="text-xs font-bold uppercase tracking-wider text-ink">{h}</div>
            <ul className="mt-4 space-y-2.5">{links.map(([to, l]) => <li key={to}><Link to={to} className="text-sm text-slate-500 hover:text-brand">{l}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} EIBIL — Employment Integrity & Background Intelligence League</div>
    </footer>
  );
}

export default function PublicLayout() {
  const { data: site } = useFetch(() => publicService.site(), []);
  return (
    <div className="min-h-screen bg-white">
      {site?.announcement && <div data-testid="announcement-banner" className="bg-ink px-4 py-2 text-center text-xs font-medium text-white">{site.announcement}</div>}
      <Navbar />
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
