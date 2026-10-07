import { Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { HOME_BY_ROLE } from '../constants';

function RoleGate({ role, children }) {
  const { user } = useAuth();
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

export default function RoleRoute({ role, children }) {
  return <ProtectedRoute><RoleGate role={role}>{children}</RoleGate></ProtectedRoute>;
}
