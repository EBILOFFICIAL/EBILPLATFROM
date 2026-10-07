import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../hooks/useAuth';

export default function DashboardShell({ nav, title, badge, headerExtra }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const logout = async () => { await signOut(); navigate('/login'); };
  const links = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto">
      {nav.map((item) => item.section ? <div key={item.section} className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.section}</div> : (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} data-testid={`sidebar-${item.to.split('/').filter(Boolean).join('-')}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-brand-light text-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`}>
          <item.icon className="h-4 w-4" />{item.label}
        </NavLink>
      ))}
    </nav>
  );
  const aside = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white p-4">
      <div className="mb-4 px-2"><Logo className="h-8" /><div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</div></div>
      {links}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="truncate text-sm font-semibold text-ink" data-testid="shell-user-name">{user?.name}</div>
        <div className="truncate text-xs text-slate-500">{user?.email}</div>
        <button onClick={logout} data-testid="logout-button" className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </div>
    </aside>
  );
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="sticky top-0 hidden h-screen lg:block">{aside}</div>
      {open && <div className="fixed inset-0 z-40 flex lg:hidden"><div className="h-full">{aside}</div><div className="flex-1 bg-slate-900/30" onClick={() => setOpen(false)} /></div>}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="shell-menu-toggle">{open ? <X /> : <Menu />}</button>
          <div className="hidden text-sm text-slate-500 lg:block">{badge}</div>
          <div className="flex items-center gap-3">{headerExtra}<div className="hidden text-xs font-semibold text-slate-400 sm:block">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
