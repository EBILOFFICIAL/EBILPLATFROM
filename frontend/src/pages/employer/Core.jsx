import { useState } from 'react';
import { Users, Star, Briefcase, CreditCard, ShieldCheck, ClipboardCheck, Download, Eye } from 'lucide-react';
import { PageHeader, Panel, StatCard } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Field from '../../components/common/Field';
import FormModal from '../../components/common/FormModal';
import ScoreGauge from '../../components/common/ScoreGauge';
import { useFetch } from '../../hooks/usePagination';
import EvaluationForm from './EvaluationForm';
import { employerService } from '../../services/employerService';
import { fmtDate, fmtDateTime, label, run } from '../../utils/formatters';

export function EmployerDashboard() {
  const { data: d } = useFetch(() => employerService.dashboard(), []);
  return (<div><PageHeader eyebrow="Employer Console" title="Overview" subtitle={d?.kycStatus !== 'approved' ? 'Your company KYC is pending EIBIL approval. Rating, offers, jobs and talent search unlock after approval.' : `Evaluation period ${d?.period}`} />
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Pending verifications" value={d?.pendingVerifications} icon={ClipboardCheck} testId="stat-pending-verifications" />
      <StatCard label="Evaluations due" value={d?.evaluationsDue} icon={Star} testId="stat-evaluations-due" />
      <StatCard label="Roster" value={d?.rosterSize} icon={Users} />
      <StatCard label="New applicants" value={d?.applicants} icon={Briefcase} />
      <StatCard label="Credits" value={d?.creditBalance} icon={CreditCard} tone="text-brand" testId="stat-credits" />
      <StatCard label="Trust index" value={d?.trustIndex} icon={ShieldCheck} tone="text-emerald-600" />
    </div></div>);
}

export function ReportView({ report }) {
  const s = report.snapshot;
  return (<div data-testid="candidate-report" className="card mt-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div><h3 className="text-xl font-bold text-ink">{s.identity.fullName}</h3><p className="text-sm text-slate-500">{s.identity.eibilId} · PAN {s.identity.panMasked} · {s.identity.panVerified ? 'PAN verified' : 'PAN unverified'} · Fraud flags: {s.fraudFlags}</p><p className="mt-1 text-sm text-slate-600" data-testid="report-contact">{s.identity.email || '—'} · {s.identity.phone || '—'} · {s.identity.city || '—'}</p><p className="mt-1 text-xs text-slate-400">Score as of {fmtDateTime(s.asOf)} · Report #{report._id.slice(-6)}</p>
      <div className="mt-3 flex gap-2">{report.resumeId ? <><Button size="sm" variant="secondary" onClick={() => run(employerService.downloadResume(report.resumeId))} data-testid="report-download-resume"><Download className="h-4 w-4" />Download resume</Button><Button size="sm" variant="ghost" onClick={() => run(employerService.previewResume(report.resumeId))} data-testid="report-preview-resume"><Eye className="h-4 w-4" />Preview</Button></> : <span className="text-xs text-slate-400" data-testid="report-no-resume">No resume on file</span>}</div></div>
      <ScoreGauge score={s.score.value} band={s.score.band} size={200} />
    </div>
    <h4 className="mt-6 text-sm font-bold text-ink">Employment</h4>
    <Table rows={s.employment} columns={[{ title: 'Company', key: 'company' }, { title: 'Designation', key: 'designation' }, { title: 'Period', render: (r) => `${fmtDate(r.startDate)} – ${r.endDate ? fmtDate(r.endDate) : 'Present'}` }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />
    <h4 className="mt-6 text-sm font-bold text-ink">Evaluation summary ({s.evaluationSummary.count})</h4>
    <p className="text-sm text-slate-600">Performance {s.evaluationSummary.performance ?? '—'} · Professionalism {s.evaluationSummary.professionalism ?? '—'} · Reliability {s.evaluationSummary.reliability ?? '—'} · Conduct {s.evaluationSummary.conduct ?? '—'}</p>
    <h4 className="mt-6 text-sm font-bold text-ink">Offers</h4>
    {s.offers === 'hidden' ? <p className="text-sm text-slate-500">Hidden by candidate</p> : <Table rows={s.offers} empty="No accepted offers" columns={[{ title: 'Company', key: 'company' }, { title: 'Designation', key: 'designation' }, { title: 'Joining', render: (r) => fmtDate(r.expectedJoiningDate) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />}
    <h4 className="mt-6 text-sm font-bold text-ink">Exits</h4>
    <Table rows={s.exits} empty="No published separations" columns={[{ title: 'Company', key: 'company' }, { title: 'Type', render: (r) => label(r.separationType) }, { title: 'Status', key: 'status' }, { title: 'Notice', render: (r) => r.notice ? `${r.notice.served}/${r.notice.required}d` : '—' }, { title: 'Rehire', render: (r) => label(r.rehireEligibility) }, { title: 'Employee rebuttal', render: (r) => r.rebuttals[0]?.statement || '—' }]} />
    <p className="mt-4 text-xs text-slate-400">Salary/CTC is never included in employer reports.</p>
  </div>);
}

export function VerifyCandidate() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const { data: history, reload } = useFetch(() => employerService.reports(), []);
  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await run(employerService.verifyCandidate({ query: query.trim() })); setReport(r.data); reload(); } catch { /* toast */ } finally { setBusy(false); }
  };
  const reopen = async (id) => setReport(await employerService.report(id));
  return (<div><PageHeader title="Verify candidate" subtitle="Search by PAN (preferred), email or EIBIL ID to view the verified score and report instantly. Each new report uses 1 verification credit, and the candidate is notified that your organisation viewed their score." />
    <Panel><form onSubmit={lookup} className="flex flex-wrap items-end gap-3 p-5">
      <div className="min-w-[260px] flex-1"><Field label="PAN / email / EIBIL ID" name="query" value={query} onChange={(_, v) => setQuery(v)} required testId="verify-query" /></div>
      <Button type="submit" loading={busy} data-testid="verify-request">View score (1 credit)</Button>
    </form></Panel>
    {report && <ReportView report={report} />}
    <Panel title="Reports viewed" className="mt-6"><Table rows={history} testId="employer-reports-table" columns={[{ title: 'Candidate', render: (r) => <div><b>{r.employeeId?.fullName}</b><div className="text-xs text-slate-400">{r.employeeId?.eibilId}</div></div> }, { title: 'Score now', render: (r) => r.employeeId?.currentScore ?? '—' }, { title: 'Viewed by', render: (r) => r.viewerUserId?.name || '—' }, { title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Credits', key: 'creditsUsed' }, { title: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => reopen(r._id)} data-testid={`report-${r._id}`}>Open report</Button> }]} /></Panel>
  </div>);
}

export function Employees() {
  const { data, loading, reload } = useFetch(() => employerService.employees(), []);
  const [add, setAdd] = useState(false);
  const [sep, setSep] = useState(null);
  return (<div><PageHeader title="Employee roster" subtitle="Add employees by PAN (a claimable shell profile is created if none exists), verify declared employment, and log exits." actions={<Button onClick={() => setAdd(true)} data-testid="add-employee">Add employee</Button>} />
    <Panel><Table loading={loading} rows={data} testId="roster-table" columns={[
      { title: 'Employee', render: (r) => <div><b>{r.employeeId?.fullName}</b><div className="text-xs text-slate-400">{r.employeeId?.eibilId} · {r.employeeId?.panMasked || 'PAN —'}{r.employeeId?.isShell ? ' · unclaimed' : ''}</div></div> },
      { title: 'Designation', key: 'designation' }, { title: 'Since', render: (r) => fmtDate(r.startDate) }, { title: 'Score', render: (r) => r.employeeId?.currentScore ?? '—' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'declared' && <><Button size="sm" onClick={() => run(employerService.verifyEmployment(r._id, { action: 'approve' })).then(reload)} data-testid={`approve-employment-${r._id}`}>Verify</Button><Button size="sm" variant="secondary" onClick={() => run(employerService.verifyEmployment(r._id, { action: 'reject', reason: 'Not an employee' })).then(reload)}>Reject</Button></>}
        {r.status === 'verified' && r.isCurrent && <Button size="sm" variant="secondary" onClick={() => setSep(r._id)} data-testid={`log-exit-${r._id}`}>Log exit</Button>}
      </div>) },
    ]} /></Panel>
    <FormModal open={add} onClose={() => setAdd(false)} title="Add employee" testId="add-employee-modal" fields={[{ name: 'pan', label: 'PAN', required: true }, { name: 'fullName', label: 'Full name', required: true }, { name: 'designation', label: 'Designation', required: true }, { name: 'department', label: 'Department' }, { name: 'startDate', label: 'Start date', type: 'date', required: true }]} onSubmit={(f) => run(employerService.addEmployee({ ...f, pan: f.pan.toUpperCase() })).then(reload)} />
    <FormModal open={Boolean(sep)} onClose={() => setSep(null)} title="Log separation" testId="log-separation-modal" fields={[{ name: 'separationType', label: 'Type', type: 'select', required: true, options: ['resignation', 'termination_performance', 'termination_misconduct', 'absconded', 'end_of_contract', 'layoff', 'retirement', 'mutual_separation'] }, { name: 'reasonCategory', label: 'Reason', type: 'select', required: true, options: ['better_opportunity', 'relocation', 'performance', 'misconduct', 'restructuring', 'contract_completed', 'personal', 'other'] }, { name: 'resignationDate', label: 'Resignation / notice date', type: 'date', required: true }, { name: 'lastWorkingDay', label: 'Last working day', type: 'date', required: true }]} onSubmit={(f) => run(employerService.logSeparation({ ...f, employmentRecordId: sep })).then(reload)} />
  </div>);
}

export function EmployerEvaluations() {
  const { data, loading, reload } = useFetch(() => employerService.evaluations(), []);
  const { data: roster } = useFetch(() => employerService.employees('verified'), []);
  const [open, setOpen] = useState(false);
  return (<div><PageHeader title="Quarterly evaluations" subtitle="Answer the EIBIL questionnaire for each verified employee. Answers are scored into four dimensions (performance, professionalism, reliability, conduct). Minimum tenure 30 days; one evaluation per employee per period; outliers are held for admin review." actions={<Button onClick={() => setOpen(true)} data-testid="new-evaluation">New evaluation</Button>} />
    <Panel><Table loading={loading} rows={data} testId="employer-evaluations-table" columns={[
      { title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Period', key: 'period' }, { title: 'Ratings', render: (r) => <span className="font-mono">{r.performance}/{r.professionalism}/{r.reliability}/{r.conduct}</span> },
      { title: 'Composite', key: 'composite' }, { title: 'Delta', key: 'appliedDelta' }, { title: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.holdReason && <div className="mt-1 text-[11px] text-amber-700">{r.holdReason}</div>}</> },
      { title: '', render: (r) => r.status === 'draft' && <Button size="sm" onClick={() => run(employerService.updateEvaluation(r._id, { submit: true })).then(reload)} data-testid={`submit-eval-${r._id}`}>Submit</Button> },
    ]} /></Panel>
    {open && <EvaluationForm roster={roster || []} onClose={() => setOpen(false)} onDone={() => setTimeout(reload, 800)} />}
  </div>);
}
