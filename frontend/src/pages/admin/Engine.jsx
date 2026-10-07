import { useState } from 'react';
import ResourcePage from '../../components/admin/ResourcePage';
import { PageHeader, Panel, Tabs } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import Modal from '../../components/common/Modal';
import { useFetch } from '../../hooks/usePagination';
import { adminService as A } from '../../services/adminService';
import { fmtDate, fmtDateTime, fmtInr, label, run } from '../../utils/formatters';

const PARAMS = ['baseline', 'min', 'max', 'bands', 'weights', 'sensitivityK', 'neutralComposite', 'cycleCap', 'recencyHalfLifeMonths', 'trustTierWeights', 'exitRules', 'events'];

function JsonEditor({ open, onClose, title, value, onSave, testId = 'json-editor' }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  return (<Modal open={open} onClose={onClose} title={title} wide testId={testId}>
    <textarea data-testid={`${testId}-text`} className="input h-96 font-mono text-xs" defaultValue={JSON.stringify(value, null, 2)} onChange={(e) => setText(e.target.value)} />
    {err && <p className="mt-2 text-sm text-brand">{err}</p>}
    <div className="mt-4 flex justify-end"><Button data-testid={`${testId}-save`} onClick={async () => { try { await onSave(text ? JSON.parse(text) : value); onClose(); } catch (e) { setErr(e.message); } }}>Save</Button></div>
  </Modal>);
}

export function AdminScore() {
  const { data, reload } = useFetch(() => A.get('/score-config'), []);
  const { data: adj, reload: ra } = useFetch(() => A.get('/score/adjust'), []);
  const [edit, setEdit] = useState(null);
  const [preview, setPreview] = useState(null);
  const [adjOpen, setAdjOpen] = useState(false);
  const active = data?.find((c) => c.status === 'active');
  const pick = (c) => Object.fromEntries(PARAMS.map((p) => [p, c[p]]));
  return (<div><PageHeader title="Score engine control" subtitle="Versioned configs with preview simulation and maker-checker approval. A different admin must approve activation and manual adjustments." actions={<><Button variant="secondary" onClick={() => run(A.post('/score/recalculate'))} data-testid="recalc-all">Full recalculation</Button><Button variant="secondary" onClick={() => setAdjOpen(true)} data-testid="manual-adjust">Manual adjustment</Button><Button onClick={async () => { await run(A.post('/score-config', { notes: 'New draft' })); reload(); }} data-testid="new-config-draft">New draft</Button></>} />
    {active && <Panel title={`Active v${active.version}`} className="mb-6"><div className="grid gap-3 p-5 text-sm sm:grid-cols-4"><div>Baseline <b>{active.baseline}</b></div><div>Range <b>{active.min}–{active.max}</b></div><div>k <b>{active.sensitivityK}</b> · cap <b>±{active.cycleCap}</b></div><div>Weights <b>{Object.values(active.weights || {}).join('/')}</b></div></div></Panel>}
    <Panel title="Versions" className="mb-6"><Table rows={data} testId="score-config-table" columns={[{ title: 'Version', render: (r) => `v${r.version}` }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Notes', key: 'notes' }, { title: 'Maker', render: (r) => r.createdBy?.name || 'seed' }, { title: 'Checker', render: (r) => r.approvedBy?.name || '—' }, { title: '', render: (r) => (<div className="flex flex-wrap gap-1">
      {r.status === 'draft' && <><Button size="sm" variant="secondary" onClick={() => setEdit(r)} data-testid={`edit-config-${r.version}`}>Edit</Button><Button size="sm" onClick={() => run(A.post(`/score-config/${r._id}/submit`)).then(reload)} data-testid={`submit-config-${r.version}`}>Submit</Button></>}
      {r.status === 'pending_approval' && <><Button size="sm" onClick={() => run(A.post(`/score-config/${r._id}/decide`, { approve: true })).then(reload)} data-testid={`approve-config-${r.version}`}>Approve</Button><Button size="sm" variant="ghost" onClick={() => run(A.post(`/score-config/${r._id}/decide`, { approve: false })).then(reload)}>Reject</Button></>}
      <Button size="sm" variant="ghost" onClick={async () => setPreview(await A.get(`/score-config/${r._id}/preview`))} data-testid={`preview-config-${r.version}`}>Preview</Button>
      {r.status === 'archived' && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/score-config/rollback/${r.version}`)).then(reload)}>Rollback</Button>}
    </div>) }]} /></Panel>
    <Panel title="Manual adjustments (dual approval)"><Table rows={adj} testId="adjustments-table" columns={[{ title: 'Profile', render: (r) => `${r.employeeId?.fullName} (${r.employeeId?.currentScore})` }, { title: 'Delta', key: 'delta' }, { title: 'Reason', key: 'reason' }, { title: 'Requested by', render: (r) => r.requestedBy?.name }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => r.status === 'pending' && <Button size="sm" onClick={() => run(A.post(`/score/adjust/${r._id}/decide`, { approve: true })).then(ra)} data-testid={`approve-adjust-${r._id}`}>Approve</Button> }]} /></Panel>
    {edit && <JsonEditor open onClose={() => setEdit(null)} title={`Edit draft v${edit.version}`} value={pick(edit)} onSave={(v) => run(A.put(`/score-config/${edit._id}`, v)).then(reload)} testId="config-editor" />}
    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={`Impact preview v${preview?.version}`} wide testId="preview-modal">{preview && <><p className="mb-3 text-sm">Sampled {preview.sampled} profiles · avg change {preview.avgChange} · band changes {preview.bandChanges}</p><Table rows={preview.rows} columns={[{ title: 'Profile', key: 'name' }, { title: 'Current', key: 'current' }, { title: 'Simulated', key: 'simulated' }, { title: 'Δ', key: 'change' }, { title: 'Band', render: (r) => `${r.currentBand} → ${r.simulatedBand}` }]} /></>}</Modal>
    <FormModal open={adjOpen} onClose={() => setAdjOpen(false)} title="Request manual score adjustment" testId="adjust-modal" fields={[{ name: 'employeeId', label: 'Employee profile ID', required: true }, { name: 'delta', label: 'Delta (+/-)', type: 'number', required: true }, { name: 'reason', label: 'Mandatory reason', type: 'textarea', required: true }]} onSubmit={(f) => run(A.post('/score/adjust', f)).then(ra)} />
  </div>);
}

export function AdminScoreJobs() {
  const { data, reload } = useFetch(() => A.get('/score/jobs'), []);
  return (<div><PageHeader title="Score refresh control" subtitle={`Queue mode: ${data?.queueMode || '…'} (BullMQ with Redis, in-process fallback otherwise). Run any scheduled job on demand.`} />
    <div className="mb-6 grid gap-4 md:grid-cols-4">{(data?.jobs || []).map((j) => <div key={j.name} className="card p-4"><b className="text-sm text-ink">{j.label}</b><div className="font-mono text-[11px] text-slate-400">{j.schedule}</div><Button size="sm" className="mt-3" onClick={() => run(A.post(`/score/jobs/${j.name}/run`)).then(reload)} data-testid={`run-job-${j.name}`}>Run now</Button></div>)}</div>
    <Panel title="Run log"><Table rows={data?.runs} testId="job-runs-table" columns={[{ title: 'Job', key: 'jobType' }, { title: 'Trigger', key: 'trigger' }, { title: 'Started', render: (r) => fmtDateTime(r.startedAt) }, { title: 'Processed', key: 'profilesProcessed' }, { title: 'Changes', key: 'changes' }, { title: 'Failures', key: 'failures' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Log', render: (r) => <span className="text-[11px]">{r.log?.slice(0, 2).join('; ')}</span> }]} /></Panel></div>);
}

export function AdminDisputes() {
  const [tab, setTab] = useState('disputes');
  const [resolve, setResolve] = useState(null);
  return (<div><Tabs tabs={[{ value: 'disputes', label: 'Disputes' }, { value: 'evaluations', label: 'Evaluations' }]} value={tab} onChange={setTab} />
    {tab === 'disputes' ? <ResourcePage key="d" title="Disputes" path="/disputes" testId="admin-disputes" search={false} filters={[{ name: 'status', label: 'Status', options: ['open', 'under_review', 'resolved_employee', 'resolved_employer', 'modified', 'rejected'] }]} columns={(reload) => [{ title: 'Raised', render: (r) => fmtDate(r.createdAt) }, { title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Target', render: (r) => label(r.targetType) }, { title: 'Reason', key: 'reason' }, { title: 'SLA', render: (r) => <span className={new Date(r.slaDueAt) < new Date() ? 'text-brand' : ''}>{fmtDate(r.slaDueAt)}</span> }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => ['open', 'under_review'].includes(r.status) && <Button size="sm" onClick={() => setResolve({ id: r._id, reload })} data-testid={`resolve-dispute-${r._id}`}>Resolve</Button> }]} />
      : <ResourcePage key="e" title="Evaluations" path="/evaluations" testId="admin-evaluations" search={false} filters={[{ name: 'status', label: 'Status', options: ['submitted', 'held', 'accepted', 'disputed', 'removed'] }]} columns={(reload) => [{ title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Period', key: 'period' }, { title: 'Composite', key: 'composite' }, { title: 'Delta', key: 'appliedDelta' }, { title: 'Status', render: (r) => <><StatusBadge status={r.status} /><div className="text-[11px] text-amber-700">{r.holdReason}</div></> }, { title: '', render: (r) => <div className="flex gap-1">{r.status === 'held' && <Button size="sm" onClick={() => run(A.post(`/evaluations/${r._id}/release`)).then(reload)} data-testid={`release-eval-${r._id}`}>Release</Button>}{['held', 'accepted'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/evaluations/${r._id}/remove`, { reason: 'Admin review' })).then(reload)}>Remove</Button>}</div> }]} />}
    <FormModal open={Boolean(resolve)} onClose={() => setResolve(null)} title="Resolve dispute" testId="resolve-modal" fields={[{ name: 'outcome', label: 'Outcome', type: 'select', required: true, options: [{ value: 'employee', label: 'Uphold for employee (remove/reverse)' }, { value: 'employer', label: 'Reject dispute (record stands)' }, { value: 'reject', label: 'Reject (invalid)' }] }, { name: 'resolution', label: 'Written outcome to employee', type: 'textarea', required: true }]} onSubmit={(f) => run(A.post(`/disputes/${resolve.id}/resolve`, f)).then(resolve.reload)} />
  </div>);
}

export function AdminOffers() {
  const { data: trust, reload: rt } = useFetch(() => A.get('/employer-trust'), []);
  return (<><ResourcePage title="Offer oversight" path="/offers" testId="admin-offers" search={false} filters={[{ name: 'status', label: 'Status', options: ['issued', 'accepted', 'joined', 'declined', 'expired', 'no_show', 'withdrawn'] }]} actions={() => <Button variant="secondary" onClick={() => run(A.post('/offers/process-no-shows'))}>Process no-shows</Button>} columns={(reload) => [{ title: 'Candidate', render: (r) => r.employeeId?.fullName }, { title: 'Company', render: (r) => r.employerId?.companyName || r.companyName }, { title: 'Designation', key: 'designation' }, { title: 'Source', render: (r) => r.verified ? 'Verified' : 'Unverified' }, { title: 'Overlap', render: (r) => r.overlapFlag ? <StatusBadge status="high">Flagged</StatusBadge> : '—' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => !r.verified && <Button size="sm" variant="secondary" onClick={() => run(A.post(`/offers/${r._id}/verify`)).then(reload)}>Verify</Button> }]} />
    <Panel title="Employer Trust Index" className="mt-6"><Table rows={trust} testId="trust-table" columns={[{ title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Issued', key: 'offersIssued' }, { title: 'Withdrawn (after accept)', render: (r) => `${r.offersWithdrawn} (${r.acceptedWithdrawn})` }, { title: 'Exit on-time', render: (r) => `${r.exitAssessmentsOnTime}/${r.exitAssessmentsDue}` }, { title: 'Index', render: (r) => <b>{r.trustIndex}</b> }, { title: 'Manual adj.', render: (r) => <input type="number" className="input w-20 py-1" defaultValue={r.manualAdjustment} onBlur={(e) => run(A.post(`/employer-trust/${r.employerId?._id}`, { manualAdjustment: Number(e.target.value) })).then(rt)} /> }]} /></Panel></>);
}

export function AdminSeparations() {
  const { data, reload } = useFetch(() => A.get('/separations'), []);
  const { data: refs } = useFetch(() => A.get('/reference-requests'), []);
  return (<div><PageHeader title="Separation cases & reference monitor" subtitle="Misconduct and absconding penalties are blocked until an admin reviews the evidence." />
    <Panel className="mb-6"><Table rows={data} testId="admin-separations-table" columns={[{ title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Type', render: (r) => label(r.separationType) }, { title: 'LWD', render: (r) => fmtDate(r.lastWorkingDay) }, { title: 'Evidence', render: (r) => r.assessment?.disciplinaryEvidence?.length || 0 }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => (<div className="flex gap-1">
      {r.status === 'admin_review' && <><Button size="sm" onClick={() => run(A.post(`/separations/${r._id}/review`, { approve: true, note: 'Evidence verified' })).then(reload)} data-testid={`approve-sep-${r._id}`}>Approve penalty</Button><Button size="sm" variant="secondary" onClick={() => run(A.post(`/separations/${r._id}/review`, { approve: false, note: 'Insufficient evidence' })).then(reload)}>No penalty</Button></>}
      {r.status === 'review_window' && <><Button size="sm" variant="ghost" onClick={() => run(A.post(`/separations/${r._id}/review`, { approve: true, note: 'Pre-reviewed' })).then(reload)}>Mark reviewed</Button><Button size="sm" variant="secondary" onClick={() => run(A.post(`/separations/${r._id}/publish`)).then(reload)} data-testid={`publish-sep-${r._id}`}>Publish now</Button></>}
      {r.status === 'date_conflict' && <Button size="sm" onClick={() => run(A.post(`/separations/${r._id}/resolve-dates`, r.proposedDates)).then(reload)}>Accept proposed dates</Button>}
    </div>) }]} /></Panel>
    <Panel title="Reference requests"><Table rows={refs} columns={[{ title: 'Requester', render: (r) => r.requesterEmployerId?.companyName }, { title: 'Previous', render: (r) => r.previousEmployerId?.companyName }, { title: 'Candidate', render: (r) => r.employeeId?.fullName }, { title: 'Due', render: (r) => fmtDate(r.dueAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.slaBreached ? 'overdue' : r.status} /> }]} /></Panel></div>);
}

export function AdminJobs() {
  return <ResourcePage title="Jobs moderation" path="/jobs" testId="admin-jobs" search={false} filters={[{ name: 'status', label: 'Status', options: ['pending_approval', 'active', 'closed', 'rejected', 'taken_down'] }]} columns={(reload) => [{ title: 'Job', render: (r) => <b>{r.title}</b> }, { title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Min score', key: 'minEibilScore' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => <div className="flex gap-1">{r.status !== 'active' && <Button size="sm" onClick={() => run(A.put(`/jobs/${r._id}`, { status: 'active' })).then(reload)}>Approve</Button>}{r.status === 'active' && <Button size="sm" variant="secondary" onClick={() => run(A.put(`/jobs/${r._id}`, { status: 'taken_down' })).then(reload)} data-testid={`takedown-${r._id}`}>Take down</Button>}<Button size="sm" variant="ghost" onClick={() => run(A.put(`/jobs/${r._id}`, { featured: !r.featured })).then(reload)}>{r.featured ? 'Unfeature' : 'Feature'}</Button></div> }]} />;
}

export function AdminBilling() {
  const [tab, setTab] = useState('plans');
  const [edit, setEdit] = useState(null);
  const { data: gst } = useFetch(() => A.get('/billing/gst-report'), []);
  const crud = (path) => ({ actions: (reload) => <Button onClick={() => setEdit({ path, value: {}, reload })} data-testid={`new-${path.slice(1)}`}>New</Button>, edit: (r, reload) => <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => { const { _id, createdAt, updatedAt, __v, ...v } = r; setEdit({ path: `${path}/${_id}`, value: v, reload, put: true }); }}>Edit</Button><Button size="sm" variant="ghost" onClick={() => run(A.del(`${path}/${r._id}`)).then(reload)}>Delete</Button></div> });
  const plans = crud('/plans'); const coupons = crud('/coupons');
  return (<div><Tabs tabs={[{ value: 'plans', label: 'Plans' }, { value: 'coupons', label: 'Coupons' }, { value: 'payments', label: 'Payments' }, { value: 'gst', label: 'GST report' }]} value={tab} onChange={setTab} />
    {tab === 'plans' && <ResourcePage key="p" title="Plans" path="/plans" testId="admin-plans" actions={plans.actions} columns={(reload) => [{ title: 'Plan', render: (r) => <b>{r.name}</b> }, { title: 'Type', key: 'type' }, { title: 'Price', render: (r) => fmtInr(r.priceInr) }, { title: 'Credits', key: 'credits' }, { title: 'Jobs', key: 'jobPosts' }, { title: 'Active', render: (r) => <StatusBadge status={r.active ? 'active' : 'suspended'} /> }, { title: '', render: (r) => plans.edit(r, reload) }]} />}
    {tab === 'coupons' && <ResourcePage key="c" title="Coupons" path="/coupons" testId="admin-coupons" actions={coupons.actions} columns={(reload) => [{ title: 'Code', key: 'code' }, { title: '% off', key: 'percentOff' }, { title: 'Flat off', key: 'flatOff' }, { title: 'Used', render: (r) => `${r.used}/${r.maxUses}` }, { title: '', render: (r) => coupons.edit(r, reload) }]} />}
    {tab === 'payments' && <ResourcePage key="pay" title="Payments & invoices" path="/payments" testId="admin-payments" search={false} columns={(reload) => [{ title: 'Invoice', render: (r) => r.invoiceNumber || r.orderId }, { title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Plan', render: (r) => r.planId?.name }, { title: 'Total', render: (r) => fmtInr(r.totalAmount) }, { title: 'Mode', render: (r) => (r.mock ? 'MOCK' : 'Razorpay') }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => r.status === 'paid' && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/payments/${r._id}/refund`)).then(reload)}>Refund</Button> }]} />}
    {tab === 'gst' && <Panel title="GST report (monthly)"><Table rows={gst} columns={[{ title: 'Month', key: '_id' }, { title: 'Invoices', key: 'count' }, { title: 'Taxable', render: (r) => fmtInr(r.taxable) }, { title: 'GST', render: (r) => fmtInr(r.gst) }, { title: 'Total', render: (r) => fmtInr(r.total) }]} /></Panel>}
    {edit && <JsonEditor open onClose={() => setEdit(null)} title="Edit record (JSON)" value={edit.value} onSave={(v) => run(edit.put ? A.put(edit.path, v) : A.post(edit.path, v)).then(edit.reload)} />}
  </div>);
}

export { JsonEditor };
