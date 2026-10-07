import { LayoutDashboard, UserCheck, Users, Star, FileSignature, DoorOpen, MessagesSquare, Search, Briefcase, CreditCard, UsersRound } from 'lucide-react';
import DashboardShell from '../components/layout/DashboardShell';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/employer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employer/verify', label: 'Verify candidate', icon: UserCheck },
  { to: '/employer/employees', label: 'Employee roster', icon: Users },
  { to: '/employer/evaluations', label: 'Evaluations', icon: Star },
  { section: 'Lifecycle' },
  { to: '/employer/offers', label: 'Offer letters', icon: FileSignature },
  { to: '/employer/separations', label: 'Exits & notice', icon: DoorOpen },
  { to: '/employer/references', label: 'Reference checks', icon: MessagesSquare },
  { section: 'Hiring' },
  { to: '/employer/talent', label: 'Talent search', icon: Search },
  { to: '/employer/jobs', label: 'Jobs & pipeline', icon: Briefcase },
  { section: 'Account' },
  { to: '/employer/billing', label: 'Plans & credits', icon: CreditCard },
  { to: '/employer/team', label: 'Team & audit', icon: UsersRound },
];

export default function EmployerLayout() {
  const { user } = useAuth();
  return <DashboardShell nav={NAV} title="Employer Console" badge={<span className="flex items-center gap-2"><b className="text-ink">{user?.employer?.companyName}</b><StatusBadge status={user?.employer?.kycStatus} /> · {user?.employer?.creditBalance ?? 0} credits</span>} />;
}
