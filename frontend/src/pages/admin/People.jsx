import { useState } from 'react';
import { Users, Building2, ScanFace, ShieldAlert, Gavel, IndianRupee, Briefcase, Gauge, Contact, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ResourcePage from '../../components/admin/ResourcePage';
import { AdminActivityFeed } from './DataExplorer';
import { PageHeader, Panel, StatCard } from '../../components/common/Layout';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import Modal from '../../components/common/Modal';
import { useFetch } from '../../hooks/usePagination';
import { adminService } from '../../services/adminService';
import { fmtDate, fmtDateTime, fmtInr, run } from '../../utils/formatters';

const A = adminService;

const BUCKETS = { 300: [300, 599], 600: [600, 749], 750: [750, 849], 850: [850, 899], 900: [900, 950] };

export function AdminDashboard() {
  const nav = useNavigate();
  const { data: d } = useFetch(() => A.get('/analytics'), []);
  const openBucket = (b) => { const r = BUCKETS[b?.bucket]; if (r) nav(`/admin/employees?scoreMin=${r[0]}&scoreMax=${r[1]}&sort=score_desc`); };
  return (<div><PageHeader eyebrow="Admin Console" title="Platform overview" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard to="/admin/users" label="Users" value={d?.users} icon={Users} testId="admin-stat-users" /><StatCard to="/admin/employees" label="Employees" value={d?.employees} icon={Contact} testId="admin-stat-employees" />
      <StatCard to="/admin/employers?kycStatus=pending" label="Employers (pending)" value={d && `${d.employers} (${d.pendingEmployers})`} icon={Building2} testId="admin-stat-employers" /><StatCard to="/admin/verification" label="PAN verified / queue" value={d && `${d.panVerified} / ${d.panQueue}`} icon={ScanFace} testId="admin-stat-pan" />
      <StatCard to="/admin/fraud" label="Open fraud flags" value={d?.fraudOpen} icon={ShieldAlert} tone="text-brand" testId="admin-stat-fraud" /><StatCard to="/admin/disputes?tab=evaluations" label="Evaluations" value={d?.evaluations} icon={Gauge} testId="admin-stat-evaluations" />
      <StatCard to="/admin/disputes" label="Disputes (overdue)" value={d && `${d.openDisputes} (${d.overdueDisputes})`} icon={Gavel} testId="admin-stat-disputes" /><StatCard to="/admin/billing" label="Revenue" value={fmtInr(d?.revenue)} icon={IndianRupee} tone="text-emerald-600" testId="admin-stat-revenue" />
      <StatCard to="/admin/jobs?status=active" label="Active jobs" value={d?.activeJobs} icon={Briefcase} testId="admin-stat-jobs" /><StatCard to="/admin/applications" label="Applications" value={(d?.funnel || []).reduce((a, f) => a + f.count, 0)} icon={FileText} testId="admin-stat-applications" />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Panel title="Score distribution (click a bar)" testId="admin-score-distribution"><div className="h-64 p-4"><ResponsiveContainer><BarChart data={(d?.scoreDistribution || []).map((x) => ({ ...x, label: BUCKETS[x.bucket] ? `${BUCKETS[x.bucket][0]}–${BUCKETS[x.bucket][1]}` : x.bucket }))}><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#D7141A" radius={[6, 6, 0, 0]} cursor="pointer" onClick={openBucket} /></BarChart></ResponsiveContainer></div></Panel>
      <div className="lg:col-span-2"><AdminActivityFeed compact /></div>
      <Panel title="Application funnel & provider costs"><div className="space-y-2 p-5 text-sm">{(d?.funnel || []).map((f) => <Link key={f._id} to={`/admin/applications?status=${f._id}`} className="flex justify-between rounded-lg px-2 py-1 hover:bg-slate-50" data-testid={`funnel-${f._id}`}><StatusBadge status={f._id} /><b>{f.count}</b></Link>)}<div className="border-t pt-3 text-slate-500">PAN checks: {d?.providerCosts?.panChecks} (est. {fmtInr(d?.providerCosts?.estimatedPanCostInr)}) · Messages sent: {d?.providerCosts?.emails}</div></div></Panel>
    </div></div>);
}

export function AdminUsers() {
  const [detail, setDetail] = useState(null);
  const open = async (id) => setDetail(await A.get(`/users/${id}`));
  return (<>
    <ResourcePage title="Users" path="/users" testId="admin-users" filters={[{ name: 'role', label: 'Role', options: ['employee', 'employer', 'admin'] }, { name: 'status', label: 'Status', options: ['active', 'suspended', 'banned'] }]} columns={(reload) => [
      { title: 'User', render: (r) => <div><b>{r.name}</b><div className="text-xs text-slate-400">{r.email}</div></div> }, { title: 'Role', key: 'role' },
      { title: 'Profile', render: (r) => r.profile ? <span className="text-xs">{r.profile.eibilId} · {r.profile.panMasked || 'no PAN'} · {r.profile.currentScore ?? '—'}</span> : '—' },
      { title: 'Verified', render: (r) => <StatusBadge status={r.emailVerified ? 'verified' : 'pending'}>{r.emailVerified ? 'Email ✓' : 'Email pending'}</StatusBadge> }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => (<div className="flex flex-wrap gap-1">
        <Button size="sm" variant="secondary" onClick={() => open(r._id)} data-testid={`user-view-${r._id}`}>View</Button>
        <Button size="sm" variant="ghost" onClick={() => run(A.post(`/users/${r._id}/status`, { status: r.status === 'active' ? 'suspended' : 'active' })).then(reload)} data-testid={`user-suspend-${r._id}`}>{r.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>
        <Button size="sm" variant="ghost" onClick={() => run(A.post(`/users/${r._id}/force-logout`))}>Force logout</Button>
        {r.profile && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/profiles/${r.profile._id}/pause-score`, { paused: !r.profile.scorePaused })).then(reload)} data-testid={`pause-score-${r._id}`}>{r.profile.scorePaused ? 'Resume score' : 'Pause score'}</Button>}
        {r.profile && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/profiles/${r.profile._id}/recalculate`)).then(reload)}>Recalc</Button>}
      </div>) },
    ]} />
    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.user?.name} wide testId="user-detail-modal">
      {detail && <div className="space-y-3 text-sm"><p>{detail.user.email} · {detail.user.role} · PAN {detail.profile?.panMasked || '—'} ({detail.profile?.panStatus})</p>
        <b>Score history</b>{detail.scoreHistory.map((s) => <div key={s._id} className="flex justify-between border-b py-1"><span>{s.reason}</span><span className="font-mono">{s.oldScore ?? '—'}→{s.newScore}</span></div>)}
        <b>Fraud flags: {detail.flags.length}</b>
        <div className="flex gap-2 pt-2"><Button size="sm" variant="secondary" onClick={async () => { const d = await A.get(`/users/${detail.user._id}/dpdp-export`); console.info(d); run(Promise.resolve(), 'DPDP export generated (see console)'); }}>DPDP export</Button><Button size="sm" variant="ghost" onClick={() => run(A.post(`/users/${detail.user._id}/dpdp-erase`))}>DPDP erase</Button></div></div>}
    </Modal>
  </>);
}

export function AdminEmployers() {
  const [credits, setCredits] = useState(null);
  return (<>
    <ResourcePage title="Employers" subtitle="KYC approval queue, trust tier (affects evaluation weight), plan override and credits." path="/employers" testId="admin-employers" filters={[{ name: 'kycStatus', label: 'KYC', options: ['pending', 'approved', 'rejected', 'suspended'] }]} columns={(reload) => [
      { title: 'Company', render: (r) => <div><b>{r.companyName}</b><div className="text-xs text-slate-400">{r.domain} · GSTIN {r.gstin || '—'} · {r.kycNotes}</div></div> },
      { title: 'KYC', render: (r) => <StatusBadge status={r.kycStatus} /> }, { title: 'Tier', render: (r) => <select className="input py-1" value={r.trustTier} data-testid={`tier-${r._id}`} onChange={(e) => run(A.put(`/employers/${r._id}`, { trustTier: e.target.value })).then(reload)}>{['standard', 'verified', 'enterprise', 'flagged'].map((t) => <option key={t}>{t}</option>)}</select> },
      { title: 'Plan', render: (r) => r.planId?.name || '—' }, { title: 'Credits', key: 'creditBalance' },
      { title: '', render: (r) => (<div className="flex gap-1">
        {r.kycStatus !== 'approved' && <Button size="sm" onClick={() => run(A.post(`/employers/${r._id}/kyc`, { kycStatus: 'approved' })).then(reload)} data-testid={`approve-employer-${r._id}`}>Approve</Button>}
        {r.kycStatus === 'pending' && <Button size="sm" variant="secondary" onClick={() => run(A.post(`/employers/${r._id}/kyc`, { kycStatus: 'rejected' })).then(reload)}>Reject</Button>}
        {r.kycStatus === 'approved' && <Button size="sm" variant="ghost" onClick={() => run(A.post(`/employers/${r._id}/kyc`, { kycStatus: 'suspended' })).then(reload)}>Suspend</Button>}
        <Button size="sm" variant="ghost" onClick={() => setCredits({ id: r._id, reload })}>Credits</Button>
        <Link to={`/admin/employers/${r._id}`} className="btn-secondary btn-sm" data-testid={`employer-360-${r._id}`}>Full view</Link>
      </div>) },
    ]} />
    <FormModal open={Boolean(credits)} onClose={() => setCredits(null)} title="Adjust credits" fields={[{ name: 'amount', label: 'Amount (+/-)', type: 'number', required: true }, { name: 'reason', label: 'Reason', required: true }]} onSubmit={(f) => run(A.post(`/employers/${credits.id}/credits`, f)).then(credits.reload)} />
  </>);
}

export function AdminVerification() {
  const { data: docs, reload: rd } = useFetch(() => A.get('/documents'), []);
  return (<>
    <ResourcePage title="Verification queue" subtitle="PAN name mismatches and manual reviews. SLA timer shows hours open." path="/verification-queue" testId="admin-verification" search={false} columns={(reload) => [
      { title: 'Profile', render: (r) => <div><b>{r.fullName}</b><div className="text-xs text-slate-400">{r.eibilId} · {r.userId?.email}</div></div> }, { title: 'PAN', render: (r) => <span className="font-mono">{r.panMasked}</span> },
      { title: 'Provider name', key: 'panProviderName' }, { title: 'Match', render: (r) => `${Math.round((r.panNameScore || 0) * 100)}%` }, { title: 'SLA', render: (r) => `${r.slaHoursOpen}h` },
      { title: '', render: (r) => <div className="flex gap-1"><Button size="sm" onClick={() => run(A.post(`/verification-queue/${r._id}`, { approve: true, reason: 'Manual review' })).then(reload)} data-testid={`approve-pan-${r._id}`}>Approve</Button><Button size="sm" variant="secondary" onClick={() => run(A.post(`/verification-queue/${r._id}`, { approve: false, reason: 'Mismatch' })).then(reload)}>Reject</Button></div> },
    ]} />
    <Panel title="Uploaded documents" className="mt-6"><div className="divide-y">{(docs || []).map((d) => <div key={d._id} className="flex items-center justify-between p-4 text-sm"><span>{d.name} · {d.purpose} · {d.ownerId?.email}</span><div className="flex gap-2"><a className="btn-ghost btn-sm" href={`${import.meta.env.REACT_APP_BACKEND_URL}${d.url}`} target="_blank" rel="noreferrer">Open</a><StatusBadge status={d.status} /><Button size="sm" variant="secondary" onClick={() => run(A.post(`/documents/${d._id}`, { approve: true })).then(rd)}>Approve</Button></div></div>)}</div></Panel>
  </>);
}

export function AdminFraud() {
  const [watch, setWatch] = useState(false);
  const { data: wl, reload: rw } = useFetch(() => A.get('/watchlist'), []);
  return (<>
    <ResourcePage title="Duplicate & fraud center" path="/fraud" testId="admin-fraud" search={false} filters={[{ name: 'type', label: 'Type', options: ['duplicate_pan', 'duplicate_email', 'duplicate_mobile', 'near_duplicate', 'overlapping_employment', 'rating_outlier', 'offer_overlap', 'repeated_withdrawals', 'watchlist_hit'] }, { name: 'status', label: 'Status', options: ['open', 'investigating', 'resolved', 'dismissed'] }]}
      actions={() => <Button variant="secondary" onClick={() => setWatch(true)} data-testid="add-watchlist">Add to watchlist</Button>}
      columns={(reload) => [{ title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Type', render: (r) => <StatusBadge status={r.severity}>{r.type}</StatusBadge> }, { title: 'Subject', render: (r) => r.employeeId ? `${r.employeeId.fullName} (${r.employeeId.eibilId})` : r.employerId?.companyName || '—' }, { title: 'Details', render: (r) => <code className="text-[11px]">{JSON.stringify(r.details)}</code> }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => r.status === 'open' && <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => run(A.put(`/fraud/${r._id}`, { status: 'resolved' })).then(reload)}>Resolve</Button><Button size="sm" variant="ghost" onClick={() => run(A.put(`/fraud/${r._id}`, { status: 'dismissed' })).then(reload)}>Dismiss</Button></div> }]} />
    <Panel title="Watchlist / blacklist" className="mt-6"><div className="divide-y">{(wl || []).map((w) => <div key={w._id} className="flex justify-between p-4 text-sm"><span><StatusBadge status={w.type} tone="red" /> {w.type === 'pan' ? 'PAN (hashed)' : w.value} — {w.reason}</span><Button size="sm" variant="ghost" onClick={() => run(A.del(`/watchlist/${w._id}`)).then(rw)}>Remove</Button></div>)}</div></Panel>
    <FormModal open={watch} onClose={() => setWatch(false)} title="Add watchlist entry" fields={[{ name: 'type', label: 'Type', type: 'select', required: true, options: ['pan', 'email_domain', 'ip', 'employer', 'email'] }, { name: 'value', label: 'Value', required: true }, { name: 'reason', label: 'Reason', required: true }]} onSubmit={(f) => run(A.post('/watchlist', f)).then(rw)} />
  </>);
}

export const fmt = { fmtDate, fmtDateTime };
