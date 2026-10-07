import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import EmployeeLayout from '../layouts/EmployeeLayout';
import EmployerLayout from '../layouts/EmployerLayout';
import AdminLayout from '../layouts/AdminLayout';
import RoleRoute from './RoleRoute';
import Home from '../pages/public/Home';
import CmsPage from '../pages/public/CmsPage';
import Pricing from '../pages/public/Pricing';
import Contact from '../pages/public/Contact';
import Jobs from '../pages/public/Jobs';
import JobDetail from '../pages/public/JobDetail';
import VerifyReport from '../pages/public/VerifyReport';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import VerifyEmail from '../pages/auth/VerifyEmail';
import ForgotPassword from '../pages/auth/ForgotPassword';
import EmployeeDashboard from '../pages/employee/Dashboard';
import Employment from '../pages/employee/Employment';
import { ScoreHistory, Evaluations, Disputes } from '../pages/employee/Records';
import { EmployeeJobs, Applications, Consents, Notifications, Settings } from '../pages/employee/Account';
import EmployeeOffers from '../pages/employee/offers/Offers';
import Exit from '../pages/employee/exit/Exit';
import { EmployerDashboard, VerifyCandidate, Employees, EmployerEvaluations } from '../pages/employer/Core';
import { Talent, EmployerJobs, Billing, Team } from '../pages/employer/Hiring';
import EmployerOffers from '../pages/employer/offers/Offers';
import Separations from '../pages/employer/separations/Separations';
import References from '../pages/employer/references/References';
import { AdminDashboard, AdminUsers, AdminEmployers, AdminVerification, AdminFraud } from '../pages/admin/People';
import { AdminScore, AdminScoreJobs, AdminDisputes, AdminJobs, AdminBilling } from '../pages/admin/Engine';
import AdminOffers from '../pages/admin/offers/Offers';
import AdminSeparations from '../pages/admin/separations/Separations';
import { AdminCms, AdminRoles, AdminAudit, AdminSettings, AdminTickets, AdminBroadcasts } from '../pages/admin/Governance';

const CMS_ROUTES = ['about', 'platform', 'score-system', 'how-it-works', 'csr', 'faq', 'privacy', 'terms', 'security', 'compliance'];

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        {CMS_ROUTES.map((s) => <Route key={s} path={s} element={<CmsPage slug={s} />} />)}
        <Route path="pricing" element={<Pricing />} />
        <Route path="contact" element={<Contact />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="verify" element={<VerifyReport />} />
        <Route path="verify/:token" element={<VerifyReport />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="employee" element={<RoleRoute role="employee"><EmployeeLayout /></RoleRoute>}>
        <Route index element={<EmployeeDashboard />} />
        <Route path="score" element={<ScoreHistory />} />
        <Route path="employment" element={<Employment />} />
        <Route path="evaluations" element={<Evaluations />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="offers" element={<EmployeeOffers />} />
        <Route path="exit" element={<Exit />} />
        <Route path="jobs" element={<EmployeeJobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="applications" element={<Applications />} />
        <Route path="consents" element={<Consents />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="employer" element={<RoleRoute role="employer"><EmployerLayout /></RoleRoute>}>
        <Route index element={<EmployerDashboard />} />
        <Route path="verify" element={<VerifyCandidate />} />
        <Route path="employees" element={<Employees />} />
        <Route path="evaluations" element={<EmployerEvaluations />} />
        <Route path="offers" element={<EmployerOffers />} />
        <Route path="separations" element={<Separations />} />
        <Route path="references" element={<References />} />
        <Route path="talent" element={<Talent />} />
        <Route path="jobs" element={<EmployerJobs />} />
        <Route path="jobs/:id" element={<EmployerJobs />} />
        <Route path="billing" element={<Billing />} />
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="admin" element={<RoleRoute role="admin"><AdminLayout /></RoleRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="employers" element={<AdminEmployers />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="fraud" element={<AdminFraud />} />
        <Route path="score" element={<AdminScore />} />
        <Route path="score-jobs" element={<AdminScoreJobs />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="separations" element={<AdminSeparations />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="cms" element={<AdminCms />} />
        <Route path="roles" element={<AdminRoles />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="broadcasts" element={<AdminBroadcasts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
