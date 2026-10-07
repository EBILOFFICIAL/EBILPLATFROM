import { LayoutDashboard, Briefcase, Star, Gavel, Search, FileCheck2, ShieldCheck, LogOut as ExitIcon, ListChecks, Settings, Bell, LineChart } from 'lucide-react';
import DashboardShell from '../components/layout/DashboardShell';
import NotificationBell from '../components/common/NotificationBell';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/employee', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employee/score', label: 'Score history', icon: LineChart },
  { to: '/employee/employment', label: 'Employment', icon: Briefcase },
  { to: '/employee/evaluations', label: 'Evaluations', icon: Star },
  { to: '/employee/disputes', label: 'Disputes', icon: Gavel },
  { section: 'Career moves' },
  { to: '/employee/offers', label: 'Offers', icon: FileCheck2 },
  { to: '/employee/exit', label: 'Resignation & exit', icon: ExitIcon },
  { to: '/employee/jobs', label: 'Jobs', icon: Search },
  { to: '/employee/applications', label: 'Applications', icon: ListChecks },
  { section: 'Privacy' },
  { to: '/employee/consents', label: 'Consent & privacy', icon: ShieldCheck },
  { to: '/employee/notifications', label: 'Notifications', icon: Bell },
  { to: '/employee/settings', label: 'Settings', icon: Settings },
];

export default function EmployeeLayout() {
  const { user } = useAuth();
  return <DashboardShell nav={NAV} title="Career Hub" headerExtra={<NotificationBell />} badge={<span>EIBIL ID <b className="font-mono text-ink">{user?.profile?.eibilId}</b> · PAN {user?.profile?.panMasked || 'not verified'}</span>} />;
}
