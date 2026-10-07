import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import { adminService as A } from '../../services/adminService';
import { downloadCsv, inRange } from '../../utils/csv';
import { fmtDate, run } from '../../utils/formatters';
import { PIPELINE } from '../../constants';

// Tabbed section list used by the employee & employer 360 views; each tab has date filter + CSV export
export function Tabs({ tabs, testId }) {
  const [active, setActive] = useState(tabs[0].key);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const tab = tabs.find((t) => t.key === active);
  const rows = inRange(tab.rows, from, to);
  return (<Panel testId={testId}>
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-4 pt-2">
      {tabs.map((t) => <button key={t.key} onClick={() => setActive(t.key)} data-testid={`${testId}-tab-${t.key}`} className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${active === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-ink'}`}>{t.label} <span className="text-xs text-slate-400">({t.rows?.length || 0})</span></button>)}
    </div>
    <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
      <label className="text-[11px] font-semibold text-slate-500">From<input type="date" className="input mt-0.5 h-9" value={from} onChange={(e) => setFrom(e.target.value)} data-testid={`${testId}-from`} /></label>
      <label className="text-[11px] font-semibold text-slate-500">To<input type="date" className="input mt-0.5 h-9" value={to} onChange={(e) => setTo(e.target.value)} data-testid={`${testId}-to`} /></label>
      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => downloadCsv(rows, `${testId}-${tab.key}`)} data-testid={`${testId}-export`}><FileDown className="h-4 w-4" />Export CSV</Button>
    </div>
    <Table rows={rows} columns={tab.columns} model={tab.model} onRowClick={tab.onRowClick} testId={`${testId}-${tab.key}-table`} />
  </Panel>);
}

export function AppStatusSelect({ app, onDone }) {
  return <select className="input h-8 py-0 text-xs" value={app.status} data-testid={`app-status-${app._id}`} onChange={(e) => run(A.put(`/applications/${app._id}/status`, { status: e.target.value })).then(onDone)}>{PIPELINE.map((s) => <option key={s}>{s}</option>)}</select>;
}

export function useGo() {
  const nav = useNavigate();
  return { employee: (id) => id && nav(`/admin/employees/${id}`), employer: (id) => id && nav(`/admin/employers/${id}`) };
}

export const appColumns = (reload, go, { showEmployee = true, showEmployer = true } = {}) => [
  ...(showEmployee ? [{ title: 'Candidate', render: (r) => <button className="text-left" onClick={() => go.employee(r.employeeId?._id)} data-testid={`app-candidate-${r._id}`}><b className="text-ink hover:text-brand">{r.employeeId?.fullName}</b><div className="text-xs text-slate-400">{r.employeeId?.eibilId}{r.employeeId?.email ? ` · ${r.employeeId.email}` : ''}{r.employeeId?.phone ? ` · ${r.employeeId.phone}` : ''}</div></button> }] : []),
  { title: 'Job', render: (r) => r.jobId?.title || '—' },
  ...(showEmployer ? [{ title: 'Company', render: (r) => <button className="text-sm font-medium hover:text-brand" onClick={() => go.employer(r.employerId?._id)}>{r.employerId?.companyName || '—'}</button> }] : []),
  { title: 'Score at apply', render: (r) => r.scoreAtApply ?? '—' },
  { title: 'Resume', render: (r) => r.resumeId?.fileName || '—' },
  { title: 'Status', render: (r) => <AppStatusSelect app={r} onDone={reload} /> },
  { title: 'Applied', render: (r) => fmtDate(r.createdAt) },
];

export const evalColumns = (who) => [
  { title: who === 'employer' ? 'Employer' : 'Employee', render: (r) => (who === 'employer' ? r.employerId?.companyName : `${r.employeeId?.fullName || ''} ${r.employeeId?.eibilId ? `(${r.employeeId.eibilId})` : ''}`) },
  { title: 'Period', key: 'period' }, { title: 'Perf / Prof / Rel / Cond', render: (r) => <span className="font-mono text-xs">{r.performance}/{r.professionalism}/{r.reliability}/{r.conduct}</span> },
  { title: 'Composite', render: (r) => r.composite?.toFixed?.(1) ?? '—' }, { title: 'Score change', render: (r) => r.appliedDelta ?? '—' },
  { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Created', render: (r) => fmtDate(r.createdAt) },
];
