import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, SlidersHorizontal } from 'lucide-react';
import { PageHeader, Panel, StatCard } from '../../components/common/Layout';
import ResourcePage from '../../components/admin/ResourcePage';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import StatusBadge from '../../components/common/StatusBadge';
import ScoreGauge from '../../components/common/ScoreGauge';
import ScoreTrend from '../../components/charts/ScoreTrend';
import { Tabs, appColumns, evalColumns, useGo } from '../../components/admin/InsightTabs';
import { useFetch } from '../../hooks/usePagination';
import { useRecord } from '../../context/RecordContext';
import { adminService as A } from '../../services/adminService';
import { fmtDate, fmtDateTime, run } from '../../utils/formatters';

const BANDS = ['Prime Executive', 'Excellent', 'Good', 'Fair', 'Poor'];

export function AdminEmployees() {
  const go = useGo();
  return (<ResourcePage title="Employees" subtitle="Every employee's EIBIL score, band, PAN status, current employer and applications. Click a row for the full profile." path="/employees" testId="admin-employees" onRowClick={(r) => go.employee(r._id)}
    filters={[{ name: 'band', label: 'Band', options: BANDS }, { name: 'panVerified', label: 'PAN', options: [{ value: 'true', label: 'Verified' }, { value: 'false', label: 'Not verified' }] }, { name: 'openToWork', label: 'Open to work', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] }, { name: 'scoreMin', label: 'Min score', type: 'number' }, { name: 'scoreMax', label: 'Max score', type: 'number' }]}
    sorts={[{ value: 'newest', label: 'Newest' }, { value: 'score_desc', label: 'Score high → low' }, { value: 'score_asc', label: 'Score low → high' }, { value: 'name', label: 'Name A–Z' }, { value: 'oldest', label: 'Oldest' }]}
    columns={() => [
      { title: 'Employee', render: (r) => <div><b className="text-ink">{r.fullName}</b><div className="text-xs text-slate-400">{r.eibilId} · {r.email}</div></div> },
      { title: 'Phone / City', render: (r) => <span className="text-xs">{r.phone || '—'} · {r.city || '—'}</span> },
      { title: 'EIBIL score', render: (r) => <span className="font-mono text-base font-extrabold text-ink" data-testid={`emp-score-${r._id}`}>{r.currentScore ?? '—'}</span> },
      { title: 'Band', render: (r) => r.band ? <StatusBadge status="active">{r.band}</StatusBadge> : '—' },
      { title: 'PAN', render: (r) => <StatusBadge status={r.panVerified ? 'verified' : r.panStatus || 'pending'}>{r.panVerified ? `✓ ${r.panMasked || ''}` : r.panStatus || 'not started'}</StatusBadge> },
      { title: 'Current employer', render: (r) => r.currentEmployer ? <button className="text-left text-sm font-medium hover:text-brand" onClick={() => go.employer(r.currentEmployerId)}>{r.currentEmployer}<div className="text-xs text-slate-400">{r.designation}</div></button> : <span className="text-slate-400">—</span> },
      { title: 'Applications', render: (r) => <b>{r.applications}</b> },
      { title: 'Joined', render: (r) => fmtDate(r.createdAt) },
    ]} />);
}

export function AdminApplications() {
  const go = useGo();
  return (<ResourcePage title="Applications" subtitle="Every job application on the platform. Change the status inline, or click a candidate or company to open their full view." path="/applications" testId="admin-applications"
    filters={[{ name: 'status', label: 'Status', options: ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'] }]} columns={(reload) => appColumns(reload, go)} />);
}

function Info({ rows }) {
  return <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="mt-0.5 break-words font-medium text-ink">{v ?? '—'}</dd></div>)}</dl>;
}

export function EmployeeOverview() {
  const { id } = useParams();
  const go = useGo();
  const rec = useRecord();
  const [adjust, setAdjust] = useState(false);
  const { data: d, reload } = useFetch(() => A.get(`/employees/${id}/overview`), [id, rec?.version]);
  if (!d) return <PageHeader title="Employee" subtitle="Loading…" />;
  const p = d.profile;
  const tabs = [
    { key: 'applications', label: 'Jobs applied', rows: d.applications, model: 'Application', columns: appColumns(reload, go, { showEmployee: false }) },
    { key: 'score', label: 'Score history', rows: d.scoreEvents, model: 'ScoreEvent', columns: [{ title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Reason', key: 'reason' }, { title: 'Source', render: (r) => <StatusBadge status="pending">{r.source}</StatusBadge> }, { title: 'Change', render: (r) => <b className={r.delta >= 0 ? 'text-emerald-600' : 'text-brand'}>{r.delta > 0 ? '+' : ''}{r.delta}</b> }, { title: 'Score', render: (r) => <span className="font-mono">{r.oldScore ?? '—'} → {r.newScore}</span> }] },
    { key: 'employment', label: 'Employment', rows: d.employment, model: 'EmploymentRecord', columns: [{ title: 'Company', render: (r) => <button className="font-medium hover:text-brand" onClick={() => go.employer(r.employerId?._id)}>{r.employerId?.companyName || r.companyName || '—'}</button> }, { title: 'Designation', key: 'designation' }, { title: 'From', render: (r) => fmtDate(r.startDate) }, { title: 'To', render: (r) => (r.isCurrent ? 'Present' : fmtDate(r.endDate)) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }] },
    { key: 'evaluations', label: 'Evaluations', rows: d.evaluations, model: 'Evaluation', columns: evalColumns('employer') },
    { key: 'viewers', label: 'Viewed by employers', rows: d.viewers, model: 'VerificationCheck', columns: [{ title: 'Employer', render: (r) => <button className="font-medium hover:text-brand" onClick={() => go.employer(r.employerId?._id)}>{r.employerId?.companyName}</button> }, { title: 'Viewed by', render: (r) => r.viewerUserId?.name || '—' }, { title: 'Credits', key: 'creditsUsed' }, { title: 'When', render: (r) => fmtDateTime(r.createdAt) }] },
    { key: 'offers', label: 'Offers', rows: d.offers, model: 'Offer', columns: [{ title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Designation', key: 'designation' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Created', render: (r) => fmtDate(r.createdAt) }] },
    { key: 'exits', label: 'Exits', rows: d.separations, model: 'SeparationCase', columns: [{ title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Type', key: 'type' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Created', render: (r) => fmtDate(r.createdAt) }] },
    { key: 'disputes', label: 'Disputes', rows: d.disputes, model: 'Dispute', columns: [{ title: 'Subject', render: (r) => r.subject || r.category || r.reason }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Opened', render: (r) => fmtDate(r.createdAt) }] },
    { key: 'flags', label: 'Fraud flags', rows: d.flags, model: 'FraudFlag', columns: [{ title: 'Type', key: 'type' }, { title: 'Severity', key: 'severity' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Raised', render: (r) => fmtDate(r.createdAt) }] },
  ];
  return (<div>
    <Link to="/admin/employees" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand" data-testid="back-to-employees"><ArrowLeft className="h-4 w-4" />All employees</Link>
    <PageHeader eyebrow={p.eibilId} title={p.fullName} subtitle={`${d.user?.email || ''} · ${d.user?.mobile || 'no phone'} · ${p.location || 'no city'} · joined ${fmtDate(p.createdAt)}`} actions={<>
      <Button variant="secondary" onClick={() => rec.open('EmployeeProfile', p._id)} data-testid="employee-edit-record"><Pencil className="h-4 w-4" />Edit profile</Button>
      <Button onClick={() => setAdjust(true)} data-testid="employee-adjust-score"><SlidersHorizontal className="h-4 w-4" />Change score</Button></>} />
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Panel testId="employee-score-panel"><div className="flex flex-col items-center p-5"><ScoreGauge score={p.currentScore} band={p.band} size={220} /><p className="mt-2 text-xs text-slate-400">Score as of {fmtDateTime(p.scoreUpdatedAt || p.updatedAt)}</p></div></Panel>
      <Panel title="Score trend"><div className="p-4"><ScoreTrend data={d.trend.map((t) => ({ date: t.at, score: t.score }))} /></div></Panel>
    </div>
    <div className="my-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Jobs applied" value={d.applications.length} testId="employee-stat-applications" /><StatCard label="Evaluations" value={d.evaluations.length} /><StatCard label="Employer views" value={d.viewers.length} /><StatCard label="Open disputes" value={d.disputes.filter((x) => ['open', 'under_review'].includes(x.status)).length} />
    </div>
    <Panel title="Profile" className="mb-5"><Info rows={[['PAN', `${p.panMasked || '—'} (${p.panVerified ? 'verified' : p.panStatus || 'not verified'})`], ['Account status', d.user?.status], ['Headline', p.headline], ['Experience', p.experienceYears != null ? `${p.experienceYears} yrs` : null], ['Skills', (p.skills || []).join(', ')], ['Open to work', p.openToWork ? 'Yes' : 'No'], ['Email verified', d.user?.emailVerified ? 'Yes' : 'No'], ['Last login', fmtDateTime(d.user?.lastLogin)]]} /></Panel>
    <Tabs tabs={tabs} testId="employee-360" />
    <FormModal open={adjust} onClose={() => setAdjust(false)} title="Change score (instant, recorded in ledger)" testId="employee-adjust-modal" fields={[{ name: 'delta', label: 'Change (+/- points)', type: 'number', required: true }, { name: 'reason', label: 'Reason', required: true }]} onSubmit={(f) => run(A.post('/score/adjust', { employeeId: p._id, delta: Number(f.delta), reason: f.reason })).then(() => { setAdjust(false); reload(); })} />
  </div>);
}

export function EmployerOverview() {
  const { id } = useParams();
  const go = useGo();
  const rec = useRecord();
  const { data: d, reload } = useFetch(() => A.get(`/employers/${id}/overview`), [id, rec?.version]);
  if (!d) return <PageHeader title="Employer" subtitle="Loading…" />;
  const e = d.employer;
  const tabs = [
    { key: 'jobs', label: 'Jobs posted', rows: d.jobs, model: 'Job', columns: [{ title: 'Title', render: (r) => <b>{r.title}</b> }, { title: 'Location', key: 'location' }, { title: 'Min score', key: 'minEibilScore' }, { title: 'Applicants', render: (r) => <b data-testid={`job-applicants-${r._id}`}>{r.applicantCount}</b> }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Posted', render: (r) => fmtDate(r.createdAt) }] },
    { key: 'applicants', label: 'All applicants', rows: d.applications, model: 'Application', columns: appColumns(reload, go, { showEmployer: false }) },
    { key: 'roster', label: 'Employees (roster)', rows: d.roster, onRowClick: (r) => go.employee(r.employeeId?._id), columns: [{ title: 'Employee', render: (r) => <div><b>{r.employeeId?.fullName}</b><div className="text-xs text-slate-400">{r.employeeId?.eibilId}</div></div> }, { title: 'Score', render: (r) => r.employeeId?.currentScore ?? '—' }, { title: 'Designation', key: 'designation' }, { title: 'From', render: (r) => fmtDate(r.startDate) }, { title: 'Current', render: (r) => (r.isCurrent ? 'Yes' : 'No') }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }] },
    { key: 'evaluations', label: 'Evaluations given', rows: d.evaluations, model: 'Evaluation', columns: evalColumns('employee') },
    { key: 'reports', label: 'Reports viewed', rows: d.reports, onRowClick: (r) => go.employee(r.employeeId?._id), columns: [{ title: 'Candidate', render: (r) => <div><b>{r.employeeId?.fullName}</b><div className="text-xs text-slate-400">{r.employeeId?.eibilId}</div></div> }, { title: 'Score now', render: (r) => r.employeeId?.currentScore ?? '—' }, { title: 'Viewed by', render: (r) => r.viewerUserId?.name }, { title: 'Credits', key: 'creditsUsed' }, { title: 'When', render: (r) => fmtDateTime(r.createdAt) }] },
    { key: 'payments', label: 'Payments', rows: d.payments, model: 'Payment', columns: [{ title: 'Type', render: (r) => r.purpose || r.type || '—' }, { title: 'Amount', render: (r) => `₹${r.totalAmount ?? r.amount ?? 0}` }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Date', render: (r) => fmtDateTime(r.createdAt) }] },
    { key: 'credits', label: 'Credit history', rows: d.credits, model: 'CreditTransaction', columns: [{ title: 'Change', render: (r) => <b className={r.amount >= 0 ? 'text-emerald-600' : 'text-brand'}>{r.amount > 0 ? '+' : ''}{r.amount}</b> }, { title: 'Balance after', key: 'balanceAfter' }, { title: 'Reason', key: 'reason' }, { title: 'Date', render: (r) => fmtDateTime(r.createdAt) }] },
    { key: 'team', label: 'Team', rows: d.members, model: 'EmployerUser', columns: [{ title: 'Name', render: (r) => r.userId?.name }, { title: 'Email', render: (r) => r.userId?.email }, { title: 'Phone', render: (r) => r.userId?.mobile || '—' }, { title: 'Role', key: 'role' }, { title: 'Status', render: (r) => <StatusBadge status={r.userId?.status} /> }] },
  ];
  return (<div>
    <Link to="/admin/employers" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand" data-testid="back-to-employers"><ArrowLeft className="h-4 w-4" />All employers</Link>
    <PageHeader eyebrow={`${e.trustTier || 'standard'} tier`} title={e.companyName} subtitle={`${e.domain || ''} · ${e.city || ''} · ${e.industry || ''}`} actions={<Button variant="secondary" onClick={() => rec.open('Employer', e._id)} data-testid="employer-edit-record"><Pencil className="h-4 w-4" />Edit company</Button>} />
    <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="KYC" value={<StatusBadge status={e.kycStatus} />} testId="employer-stat-kyc" /><StatCard label="Credits" value={e.creditBalance} testId="employer-stat-credits" /><StatCard label="Jobs" value={d.jobs.length} /><StatCard label="Applicants" value={d.applications.length} /><StatCard label="Reports viewed" value={d.reports.length} />
    </div>
    <Panel title="Company & KYC" className="mb-5"><Info rows={[['GSTIN', e.gstin], ['CIN', e.cin], ['HR contact', e.hrContactName], ['Phone', e.phone], ['KYC notes', e.kycNotes], ['KYC checked', fmtDateTime(e.kycCheckedAt)], ['Account status', e.status], ['Plan expires', fmtDate(e.planExpiresAt)], ['Job posts used', e.jobPostsUsed], ['Joined', fmtDate(e.createdAt)]]} /></Panel>
    <Tabs tabs={tabs} testId="employer-360" />
  </div>);
}
