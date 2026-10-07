import { useState } from 'react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import { useFetch } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import { employerService, billingService } from '../../services/employerService';
import { fmtDate, fmtDateTime, fmtInr, run } from '../../utils/formatters';
import { PIPELINE } from '../../constants';

export function Talent() {
  const [f, setF] = useState({});
  const { data, loading, error } = useFetch(() => employerService.talent(f), [JSON.stringify(f)]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<div><PageHeader title="Talent search" subtitle="Open-to-work, PAN-verified professionals. Exact score shown only if the candidate allows it." />
    <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-4">{[['minScore', 'Min score'], ['skills', 'Skills (comma)'], ['location', 'Location'], ['experience', 'Min years']].map(([k, l]) => <input key={k} data-testid={`talent-${k}`} className="input" placeholder={l} onChange={set(k)} />)}</div>
    <Panel><Table loading={loading} rows={data} empty={error || 'No matches'} testId="talent-table" columns={[{ title: 'Candidate', render: (r) => <div><b>{r.fullName}</b><div className="text-xs text-slate-400">{r.eibilId} · {r.headline}</div></div> }, { title: 'Location', key: 'location' }, { title: 'Experience', render: (r) => `${r.experienceYears} yrs` }, { title: 'Skills', render: (r) => r.skills?.join(', ') }, { title: 'Band', render: (r) => <StatusBadge status={r.band} tone="blue">{r.band}{r.score ? ` · ${r.score}` : ''}</StatusBadge> }]} /></Panel></div>);
}

export function EmployerJobs() {
  const { data, loading, reload } = useFetch(() => employerService.jobs(), []);
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(null);
  const { data: pipe, reload: reloadPipe } = useFetch(() => (jobId ? employerService.applicants(jobId) : Promise.resolve(null)), [jobId]);
  const create = (f) => run(employerService.createJob({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null)), skills: f.skills ? f.skills.split(',').map((s) => s.trim()) : [], screeningQuestions: f.screeningQuestions ? [f.screeningQuestions] : [] })).then(reload);
  return (<div><PageHeader title="Jobs & applicant pipeline" actions={<Button onClick={() => setOpen(true)} data-testid="post-job">Post job</Button>} />
    <Panel className="mb-6"><Table loading={loading} rows={data} testId="employer-jobs-table" columns={[{ title: 'Title', render: (r) => <b>{r.title}</b> }, { title: 'Min score', key: 'minEibilScore' }, { title: 'Applicants', key: 'applicantsCount' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => (<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setJobId(r._id)} data-testid={`view-applicants-${r._id}`}>Pipeline</Button>{r.status === 'active' && <Button size="sm" variant="ghost" onClick={() => run(employerService.updateJob(r._id, { status: 'closed' })).then(reload)}>Close</Button>}</div>) }]} /></Panel>
    {pipe && <Panel title={`Pipeline: ${pipe.job.title}`}><Table rows={pipe.applicants} testId="applicants-table" columns={[{ title: 'Candidate', render: (r) => `${r.employeeId?.fullName} (${r.employeeId?.eibilId})` }, { title: 'Score at apply', key: 'scoreAtApply' }, { title: 'Applied', render: (r) => fmtDate(r.createdAt) }, { title: 'Answers', render: (r) => r.answers?.map((a) => a.answer).join('; ') || '—' }, { title: 'Stage', render: (r) => <select data-testid={`stage-${r._id}`} className="input py-1.5" value={r.status} onChange={(e) => run(employerService.setApplicationStatus(r._id, e.target.value)).then(reloadPipe)}>{PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}</select> }]} /></Panel>}
    <FormModal open={open} onClose={() => setOpen(false)} title="Post a job" testId="job-modal" fields={[{ name: 'title', label: 'Title', required: true, full: true }, { name: 'description', label: 'Description', type: 'textarea', required: true, full: true }, { name: 'location', label: 'Location' }, { name: 'type', label: 'Type', type: 'select', options: ['full_time', 'part_time', 'contract', 'internship', 'remote'] }, { name: 'role', label: 'Function' }, { name: 'skills', label: 'Skills (comma separated)' }, { name: 'salaryMin', label: 'Salary min (₹/yr)', type: 'number' }, { name: 'salaryMax', label: 'Salary max (₹/yr)', type: 'number' }, { name: 'experienceMin', label: 'Min experience (yrs)', type: 'number' }, { name: 'minEibilScore', label: 'Minimum EIBIL score', type: 'number' }, { name: 'screeningQuestions', label: 'Screening question', full: true }]} onSubmit={create} />
  </div>);
}

const loadRazorpay = () => new Promise((res) => { if (window.Razorpay) return res(true); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s); return null; });

export function Billing() {
  const { refresh } = useAuth();
  const { data: plans } = useFetch(() => billingService.plans(), []);
  const { data: usage, reload } = useFetch(() => employerService.usage(), []);
  const { data: invoices, reload: reloadInv } = useFetch(() => employerService.invoices(), []);
  const [coupon, setCoupon] = useState('');
  const buy = async (p) => {
    const order = await run((p.type === 'credit_pack' ? billingService.purchaseCredits : billingService.subscribe)({ planId: p._id, couponCode: coupon }), 'Order created');
    const done = async (resp = {}) => { await run(billingService.verify({ orderId: order.orderId, razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature })); reload(); reloadInv(); refresh(); };
    if (order.mock) return done();
    await loadRazorpay();
    return new window.Razorpay({ key: order.keyId, amount: order.amount, currency: 'INR', order_id: order.orderId, name: 'EIBIL', description: p.name, handler: done, theme: { color: '#D7141A' } }).open();
  };
  return (<div><PageHeader title="Plans & credits" subtitle={`Credit balance: ${usage?.creditBalance ?? '—'} · Current plan: ${usage?.plan?.name || 'None'} · Payments via Razorpay (MOCK mode until live keys are set)`} actions={<input className="input w-44" placeholder="Coupon (WELCOME20)" value={coupon} onChange={(e) => setCoupon(e.target.value)} data-testid="coupon-input" />} />
    <div className="mb-6 grid gap-4 md:grid-cols-4">{(plans || []).map((p) => <div key={p._id} className={`card p-5 ${p.highlighted ? 'ring-2 ring-brand' : ''}`}><b className="text-ink">{p.name}</b><div className="mt-2 font-display text-2xl font-extrabold">{p.priceInr ? fmtInr(p.priceInr) : 'Free'}</div><div className="text-xs text-slate-500">{p.credits} credits · {p.jobPosts} jobs · +18% GST</div><Button size="sm" className="mt-4 w-full" onClick={() => buy(p)} disabled={!p.priceInr} data-testid={`buy-${p.code}`}>{p.type === 'credit_pack' ? 'Buy credits' : 'Subscribe'}</Button></div>)}</div>
    <Panel title="Invoices" className="mb-6"><Table rows={invoices} testId="invoices-table" columns={[{ title: 'Invoice', key: 'invoiceNumber' }, { title: 'Plan', render: (r) => r.planId?.name }, { title: 'Taxable', render: (r) => fmtInr(r.baseAmount - r.discount) }, { title: 'GST', render: (r) => fmtInr(r.gstAmount) }, { title: 'Total', render: (r) => fmtInr(r.totalAmount) }, { title: 'Paid', render: (r) => fmtDateTime(r.paidAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} /></Panel>
    <Panel title="Credit usage"><Table rows={usage?.transactions} columns={[{ title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Reason', key: 'reason' }, { title: 'Amount', key: 'amount' }, { title: 'Balance', key: 'balanceAfter' }]} /></Panel>
  </div>);
}

export function Team() {
  const { data, reload } = useFetch(() => employerService.team(), []);
  const [open, setOpen] = useState(false);
  return (<div><PageHeader title="Team" subtitle="Invite HR managers and recruiters with scoped roles." actions={<Button onClick={() => setOpen(true)} data-testid="invite-member">Invite member</Button>} />
    <Panel><Table rows={data} testId="team-table" columns={[{ title: 'Name', render: (r) => r.userId?.name }, { title: 'Email', render: (r) => r.userId?.email }, { title: 'Role', key: 'role' }, { title: 'Last login', render: (r) => fmtDateTime(r.userId?.lastLogin) }, { title: '', render: (r) => r.role !== 'Owner' && <Button size="sm" variant="ghost" onClick={() => run(employerService.removeMember(r._id)).then(reload)}>Remove</Button> }]} /></Panel>
    <FormModal open={open} onClose={() => setOpen(false)} title="Invite team member" testId="invite-modal" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Work email (company domain)', type: 'email', required: true }, { name: 'role', label: 'Role', type: 'select', required: true, options: ['HR Manager', 'Recruiter', 'Viewer'] }]} onSubmit={async (f) => { const r = await run(employerService.invite(f)); if (r.data?.tempPassword) alert(`MOCK email: temporary password ${r.data.tempPassword}`); reload(); }} />
  </div>);
}
