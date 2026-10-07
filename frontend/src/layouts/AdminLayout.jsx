import { LayoutDashboard, Users, Building2, ScanFace, ShieldAlert, Gauge, Gavel, FileSignature, DoorOpen, Briefcase, CreditCard, FileText, KeyRound, ScrollText, Settings, LifeBuoy, Megaphone, Timer } from 'lucide-react';
import DashboardShell from '../components/layout/DashboardShell';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'People' },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/employers', label: 'Employers', icon: Building2 },
  { to: '/admin/verification', label: 'Verification queue', icon: ScanFace },
  { to: '/admin/fraud', label: 'Duplicate & fraud', icon: ShieldAlert },
  { section: 'Score & records' },
  { to: '/admin/score', label: 'Score engine', icon: Gauge },
  { to: '/admin/score-jobs', label: 'Score refresh jobs', icon: Timer },
  { to: '/admin/disputes', label: 'Evaluations & disputes', icon: Gavel },
  { to: '/admin/offers', label: 'Offers & trust', icon: FileSignature },
  { to: '/admin/separations', label: 'Separations & refs', icon: DoorOpen },
  { section: 'Business' },
  { to: '/admin/jobs', label: 'Jobs moderation', icon: Briefcase },
  { to: '/admin/billing', label: 'Plans & billing', icon: CreditCard },
  { to: '/admin/cms', label: 'CMS', icon: FileText },
  { section: 'Governance' },
  { to: '/admin/roles', label: 'Roles & permissions', icon: KeyRound },
  { to: '/admin/audit', label: 'Audit & ledger', icon: ScrollText },
  { to: '/admin/settings', label: 'System settings', icon: Settings },
  { to: '/admin/tickets', label: 'Support tickets', icon: LifeBuoy },
  { to: '/admin/broadcasts', label: 'Communications', icon: Megaphone },
];

export default function AdminLayout() {
  const { user } = useAuth();
  return <DashboardShell nav={NAV} title="Admin Console" badge={<span>Signed in as <b className="text-ink">{user?.adminRole?.name}</b></span>} />;
}
