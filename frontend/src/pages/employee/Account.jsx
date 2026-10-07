import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Field from '../../components/common/Field';
import { JobBoard } from '../public/Jobs';
import { DevOtp } from '../auth/Login';
import { useFetch } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import { employeeService } from '../../services/employeeService';
import { authService } from '../../services/authService';
import { fmtDate, fmtDateTime, run } from '../../utils/formatters';

export function EmployeeJobs() {
  return <div><PageHeader title="Jobs" subtitle="Score-gated jobs from verified employers. Easy Apply uses your EIBIL profile." /><JobBoard base="/employee/jobs" /></div>;
}

export function Applications() {
  const { data, loading } = useFetch(() => employeeService.applications(), []);
  return (<div><PageHeader title="Application tracker" />
    <Panel><Table loading={loading} rows={data} testId="applications-table" columns={[
      { title: 'Job', render: (r) => <b>{r.jobId?.title}</b> }, { title: 'Company', render: (r) => r.jobId?.employerId?.companyName },
      { title: 'Applied', render: (r) => fmtDate(r.createdAt) }, { title: 'Score at apply', key: 'scoreAtApply' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ]} /></Panel></div>);
}

export function Consents() {
  const { data, loading, reload } = useFetch(() => employeeService.consents(), []);
  const { data: privacy, reload: reloadPrivacy } = useFetch(() => employeeService.privacy(), []);
  const setPriv = (k, v) => run(employeeService.updatePrivacy({ [k]: v }), 'Privacy updated').then(reloadPrivacy);
  const exportData = async () => { const d = await employeeService.exportData(); const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: url, download: 'eibil-my-data.json' }).click(); };
  return (<div>
    <PageHeader title="Consent & privacy" subtitle="Who accessed your report, active consents, and what employers can see." actions={<><Button variant="secondary" onClick={exportData} data-testid="export-data"><Download className="h-4 w-4" />Download my data</Button><Button variant="ghost" onClick={() => run(employeeService.requestDeletion())} data-testid="request-deletion"><Trash2 className="h-4 w-4" />Request deletion</Button></>} />
    {privacy && <Panel title="Visibility" className="mb-6"><div className="grid gap-4 p-5 sm:grid-cols-3">
      <Field type="checkbox" name="openToWork" label="Open to Work (discoverable in talent search)" value={privacy.openToWork} onChange={setPriv} testId="toggle-open-to-work" />
      <Field type="checkbox" name="showExactScore" label="Show exact score in talent search (else band only)" value={privacy.showExactScore} onChange={setPriv} testId="toggle-exact-score" />
      <Field type="checkbox" name="allowCurrentEmployerOfferView" label="Allow current employer to see accepted offers" value={privacy.allowCurrentEmployerOfferView} onChange={setPriv} testId="toggle-current-employer-offers" />
    </div></Panel>}
    <Panel title="Consent requests" className="mb-6"><Table loading={loading} rows={data?.consents?.filter((c) => c.type === 'report_access')} testId="consents-table" columns={[
      { title: 'Employer', render: (r) => r.requesterEmployerId?.companyName }, { title: 'Purpose', key: 'purpose' }, { title: 'Mode', key: 'mode' },
      { title: 'Expires', render: (r) => fmtDate(r.expiresAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'pending' && <><Button size="sm" onClick={() => run(employeeService.respondConsent(r._id, true)).then(reload)} data-testid={`grant-consent-${r._id}`}>Grant</Button><Button size="sm" variant="secondary" onClick={() => run(employeeService.respondConsent(r._id, false)).then(reload)}>Deny</Button></>}
        {r.status === 'granted' && <Button size="sm" variant="secondary" onClick={() => run(employeeService.revokeConsent(r._id)).then(reload)} data-testid={`revoke-consent-${r._id}`}>Revoke</Button>}
      </div>) },
    ]} /></Panel>
    <Panel title="Who viewed my report"><Table rows={data?.viewers} testId="viewers-table" columns={[{ title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Viewed', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Credits', key: 'creditsUsed' }]} /></Panel>
  </div>);
}

export function Notifications() {
  const { data, loading, reload } = useFetch(() => employeeService.notifications(), []);
  return (<div><PageHeader title="Notifications" actions={<Button variant="secondary" onClick={() => run(employeeService.readNotifications(), 'Marked read').then(reload)}>Mark all read</Button>} />
    <Panel><Table loading={loading} rows={data} testId="notifications-table" columns={[{ title: '', render: (r) => !r.read && <span className="inline-block h-2 w-2 rounded-full bg-brand" /> }, { title: 'Title', render: (r) => <b>{r.title}</b> }, { title: 'Message', key: 'body' }, { title: 'When', render: (r) => fmtDateTime(r.createdAt) }]} /></Panel></div>);
}

export function Settings() {
  const { user, refresh } = useAuth();
  const [pw, setPw] = useState({});
  const [otp, setOtp] = useState(null);
  const [code, setCode] = useState('');
  const { data: sessions, reload } = useFetch(() => authService.sessions(), []);
  return (<div className="space-y-6"><PageHeader title="Settings & security" />
    <Panel title="Change password"><form className="grid gap-4 p-5 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(authService.changePassword(pw)).then(() => setPw({})).catch(() => {}); }}>
      <Field label="Current password" name="currentPassword" type="password" value={pw.currentPassword} onChange={(k, v) => setPw({ ...pw, [k]: v })} required />
      <Field label="New password" name="password" type="password" value={pw.password} onChange={(k, v) => setPw({ ...pw, [k]: v })} required />
      <div className="self-end"><Button type="submit" data-testid="change-password-submit">Update password</Button></div>
    </form></Panel>
    <Panel title="Mobile verification & 2FA"><div className="flex flex-wrap items-end gap-4 p-5">
      {user.mobileVerified ? <StatusBadge status="verified">Mobile {user.mobile} verified</StatusBadge> : (<>
        {!otp ? <Button variant="secondary" onClick={async () => setOtp((await run(authService.mobileSend())).data)} data-testid="mobile-send-otp">Send OTP to {user.mobile}</Button> : (<><DevOtp code={otp.devOtp} /><Field name="code" label="SMS code" value={code} onChange={(_, v) => setCode(v)} testId="mobile-otp" /><Button onClick={() => run(authService.mobileVerify(code)).then(refresh)} data-testid="mobile-verify">Verify</Button></>)}
      </>)}
      <Field type="checkbox" name="twofa" label="Require email OTP at every sign-in (2FA)" value={user.twoFactorEnabled} onChange={(_, v) => run(authService.setup2fa(v)).then(refresh)} testId="toggle-2fa" />
    </div></Panel>
    <Panel title="Active sessions" actions={<Button size="sm" variant="secondary" onClick={() => run(authService.revokeSessions(), 'All sessions revoked').then(reload)} data-testid="revoke-sessions">Sign out everywhere</Button>}>
      <Table rows={sessions} columns={[{ title: 'Started', render: (r) => fmtDateTime(r.createdAt) }, { title: 'IP', key: 'ip' }, { title: 'Device', render: (r) => <span className="text-xs">{r.userAgent?.slice(0, 60)}</span> }]} />
    </Panel>
  </div>);
}
