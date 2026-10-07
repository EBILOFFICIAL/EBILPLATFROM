import { useState } from 'react';
import { Database } from 'lucide-react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import { useFetch } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { useRecord, titleOf } from '../../context/RecordContext';
import { adminService as A } from '../../services/adminService';
import { fmtDateTime } from '../../utils/formatters';

const SKIP = ['_id', '__v', 'createdAt', 'updatedAt'];
const cell = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? `[${v.length}]` : '{…}') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v).length > 40 ? `${String(v).slice(0, 40)}…` : String(v));

export function DataExplorer() {
  const rec = useRecord();
  const { data: models } = useFetch(() => A.get('/data'), [rec?.version]);
  const [model, setModel] = useState('EmployeeProfile');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, meta, loading } = useFetch(() => A.list(`/data/${model}`, { q: dq, page }), [model, dq, page, rec?.version]);
  const keys = data?.length ? Object.keys(data[0]).filter((k) => !SKIP.includes(k)).slice(0, 6) : [];
  const columns = [{ title: 'Record', render: (r) => <b className="text-ink">{titleOf(r)}</b> }, ...keys.map((k) => ({ title: k, render: (r) => <span className="text-xs">{cell(r[k])}</span> })), { title: 'Created', render: (r) => <span className="text-xs text-slate-500">{fmtDateTime(r.createdAt)}</span> }];
  return (<div><PageHeader title="Data explorer" subtitle="Every collection on the platform. Click any record to view all fields, its linked records and change history, and to edit or delete it." />
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Panel title="Collections" testId="data-models"><ul className="max-h-[70vh] overflow-y-auto p-2">{(models || []).map((m) => (
        <li key={m.name}><button onClick={() => { setModel(m.name); setPage(1); setQ(''); }} data-testid={`data-model-${m.name}`} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${model === m.name ? 'bg-brand-light font-semibold text-brand' : 'text-slate-600 hover:bg-slate-50'}`}><span className="flex items-center gap-2"><Database className="h-3.5 w-3.5" />{m.name}</span><span className="font-mono text-xs text-slate-400">{m.count}</span></button></li>
      ))}</ul></Panel>
      <div>
        <input className="input mb-4 max-w-sm" placeholder={`Search ${model}… (text or id)`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} data-testid="data-search" />
        <Panel title={`${model}${meta ? ` · ${meta.total}` : ''}`}><Table loading={loading} rows={data} columns={columns} model={model} testId="data-table" />
          {meta?.pages > 1 && <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-sm"><button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="data-prev">Prev</button><span>{meta.page} / {meta.pages}</span><button className="btn-ghost btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)} data-testid="data-next">Next</button></div>}
        </Panel>
      </div>
    </div></div>);
}

export function AdminActivityFeed({ compact = false }) {
  const rec = useRecord();
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const { data, meta, loading } = useFetch(() => A.list('/activity', { mine, page, limit: compact ? 8 : 30 }), [mine, page, rec?.version]);
  const toggle = <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">{[[false, 'All admins'], [true, 'Only me']].map(([v, l]) => <button key={l} onClick={() => { setMine(v); setPage(1); }} data-testid={`activity-${v ? 'mine' : 'all'}`} className={`rounded-md px-2.5 py-1 ${mine === v ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>{l}</button>)}</div>;
  return (<Panel title="Admin activity" actions={toggle} testId="admin-activity">
    <Table loading={loading} rows={data} model="AuditLog" testId="activity-table" columns={[
      { title: 'When', render: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.createdAt)}</span> },
      { title: 'Admin', render: (r) => r.actorId?.name || '—' },
      { title: 'Action', render: (r) => <span className="font-mono text-xs font-semibold text-ink">{r.action}</span> },
      { title: 'Record', render: (r) => <span className="text-xs">{r.entityType || '—'}{r.entityId ? ` #${String(r.entityId).slice(-6)}` : ''}</span> },
      ...(compact ? [] : [{ title: 'Details', render: (r) => <span className="text-[11px] text-slate-500">{r.meta?.reason || r.meta?.path || r.meta?.notes || ''}</span> }]),
    ]} />
    {!compact && meta?.pages > 1 && <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-sm"><button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span>{meta.page} / {meta.pages}</span><button className="btn-ghost btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
  </Panel>);
}

export function AdminActivity() {
  return (<div><PageHeader title="Admin activity" subtitle="Everything admins have done on the platform: edits, approvals, score changes, config changes and deletions. Click an entry for full before/after details." /><AdminActivityFeed /></div>);
}
