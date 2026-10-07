import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, TrendingDown, TrendingUp } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { fmtDateTime } from '../../utils/formatters';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  const refresh = useCallback(() => employeeService.unreadCount().then((d) => setCount(d.count)).catch(() => {}), []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh, pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    setOpen(!open);
    if (!open) setItems((await employeeService.notifications()).slice(0, 8));
  };
  const markAll = async () => { await employeeService.readNotifications(); setItems((l) => l.map((n) => ({ ...n, read: true }))); setCount(0); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} data-testid="notification-bell" aria-label="Notifications" className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink">
        <Bell className="h-5 w-5" />
        {count > 0 && <span data-testid="notification-unread-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div data-testid="notification-dropdown" className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <b className="text-sm text-ink">Notifications</b>
            {count > 0 && <button onClick={markAll} data-testid="notification-mark-all-read" className="text-xs font-semibold text-brand">Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!items ? <li className="p-4 text-sm text-slate-400">Loading…</li> : !items.length ? <li className="p-4 text-sm text-slate-400">You're all caught up.</li> : items.map((n) => <BellItem key={n._id || n.id} n={n} onClick={() => setOpen(false)} />)}
          </ul>
          <Link to="/employee/notifications" onClick={() => setOpen(false)} data-testid="notification-view-all" className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 hover:text-brand">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

function BellItem({ n, onClick }) {
  const d = n.meta?.delta;
  const Icon = d < 0 ? TrendingDown : TrendingUp;
  return (
    <li>
      <Link to={n.link || '/employee/notifications'} onClick={onClick} data-testid="notification-item" className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${n.read ? '' : 'bg-brand-light/40'}`}>
        {n.type === 'score' ? <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${d < 0 ? 'text-brand' : 'text-emerald-600'}`} /> : <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
        <div className="min-w-0"><div className="text-sm font-semibold text-ink">{n.title}</div><div className="truncate text-xs text-slate-500">{n.body}</div><div className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</div></div>
      </Link>
    </li>
  );
}

export default NotificationBell;
