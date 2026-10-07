import { useState } from 'react';
import { Users, Star, Briefcase, CreditCard, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { PageHeader, Panel, StatCard } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Field from '../../components/common/Field';
import FormModal from '../../components/common/FormModal';
import ScoreGauge from '../../components/common/ScoreGauge';
import { DevOtp } from '../auth/Login';
import { useFetch } from '../../hooks/usePagination';
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
      <div><h3 className="text-xl font-bold text-ink">{s.identity.fullName}</h3><p className="text-sm text-slate-500">{s.identity.eibilId} · PAN {s.identity.panMasked} · {s.identity.panVerified ? 'PAN verified' : 'PAN unverified'} · Fraud flags: {s.fraudFlags}</p><p className="mt-1 text-xs text-slate-400">Score as of {fmtDateTime(s.asOf)} · Report #{report._id.slice(-6)}</p></div>
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
  const [form, setForm] = useState({ mode: 'on_demand' });
  const [req, setReq] = useState(null);
  const [code, setCode] = useState('');
  const [report, setReport] = useState(null);
  const { data: consents, reload } = useFetch(() => employerService.consents(), []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const request = async (e) => { e.preventDefault(); const r = await run(employerService.verifyCandidate(form)); setReq(r.data); reload(); };
  const generate = async (employeeId) => setReport((await run(employerService.generateReport(employeeId))).data);
  return (<div><PageHeader title="Verify candidate" subtitle="Search by PAN (preferred), email or EIBIL ID. No report without recorded candidate consent; each report uses verification credits." />
    <Panel><form onSubmit={request} className="grid gap-4 p-5 sm:grid-cols-4">
      <div className="sm:col-span-2"><Field label="PAN / email / EIBIL ID" name="query" value={form.query} onChange={set} required testId="verify-query" /></div>
      <Field label="Consent mode" name="mode" type="select" value={form.mode} onChange={set} options={[{ value: 'on_demand', label: 'Request in candidate app' }, { value: 'otp', label: 'OTP consent (candidate shares code)' }]} testId="verify-mode" />
      <div className="self-end"><Button type="submit" className="w-full" data-testid="verify-request">Request consent</Button></div>
    </form>
    {req && <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-5" data-testid="consent-request-result">
      <StatusBadge status={req.consent.status} /><span className="text-sm">Candidate {req.eibilId}</span>
      {req.consent.status === 'pending' && form.mode === 'otp' && (<><DevOtp code={req.devOtp} /><Field name="code" label="Consent OTP" value={code} onChange={(_, v) => setCode(v)} testId="consent-otp" /><Button onClick={async () => { await run(employerService.consentOtp(req.consent._id, code)); setReq({ ...req, consent: { ...req.consent, status: 'granted' } }); reload(); }} data-testid="consent-otp-submit">Verify OTP</Button></>)}
      {req.consent.status === 'granted' && <Button onClick={() => generate(req.consent.employeeId)} data-testid="generate-report">Generate report (uses credits)</Button>}
    </div>}</Panel>
    {report && <ReportView report={report} />}
    <Panel title="Consent log" className="mt-6"><Table rows={consents} testId="employer-consents-table" columns={[{ title: 'Candidate', render: (r) => `${r.employeeId?.fullName} (${r.employeeId?.eibilId})` }, { title: 'Mode', key: 'mode' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Expires', render: (r) => fmtDate(r.expiresAt) }, { title: '', render: (r) => r.status === 'granted' && <Button size="sm" onClick={() => generate(r.employeeId._id)} data-testid={`report-${r._id}`}>View report</Button> }]} /></Panel>
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
  const dims = ['performance', 'professionalism', 'reliability', 'conduct'].map((n) => ({ name: n, label: `${n} (0-100)`, type: 'number', required: true }));
  return (<div><PageHeader title="Quarterly evaluations" subtitle="Rate verified employees on four dimensions. Minimum tenure 30 days; one evaluation per employee per period; outliers are held for admin review." actions={<Button onClick={() => setOpen(true)} data-testid="new-evaluation">New evaluation</Button>} />
    <Panel><Table loading={loading} rows={data} testId="employer-evaluations-table" columns={[
      { title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Period', key: 'period' }, { title: 'Ratings', render: (r) => <span className="font-mono">{r.performance}/{r.professionalism}/{r.reliability}/{r.conduct}</span> },
      { title: 'Composite', key: 'composite' }, { title: 'Delta', key: 'appliedDelta' }, { title: 'Status', render: (r) => <><StatusBadge status={r.status} />{r.holdReason && <div className="mt-1 text-[11px] text-amber-700">{r.holdReason}</div>}</> },
      { title: '', render: (r) => r.status === 'draft' && <Button size="sm" onClick={() => run(employerService.updateEvaluation(r._id, { submit: true })).then(reload)} data-testid={`submit-eval-${r._id}`}>Submit</Button> },
    ]} /></Panel>
    <FormModal open={open} onClose={() => setOpen(false)} title="New evaluation" testId="evaluation-modal" initial={{ submit: true }} fields={[{ name: 'employmentRecordId', label: 'Employee', type: 'select', required: true, full: true, options: (roster || []).map((r) => ({ value: r._id, label: `${r.employeeId?.fullName} – ${r.designation}` })) }, { name: 'period', label: 'Period (e.g. 2026-Q3, blank = current)' }, ...dims, { name: 'comments', label: 'Factual comments', type: 'textarea', full: true }, { name: 'submit', label: 'Submit now (uncheck to save draft)', type: 'checkbox', full: true }]} onSubmit={(f) => run(employerService.createEvaluation(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null)))).then(() => setTimeout(reload, 800))} />
  </div>);
}
