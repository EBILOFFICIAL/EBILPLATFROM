import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { PageHeader, Panel } from '../common/Layout';
import Table from '../common/Table';
import Button from '../common/Button';
import { useFetch } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { adminService } from '../../services/adminService';
import { useRecord } from '../../context/RecordContext';
import { downloadCsv, inRange } from '../../utils/csv';
import { run } from '../../utils/formatters';

const MODEL_BY_PATH = { '/users': 'User', '/employers': 'Employer', '/verification-queue': 'EmployeeProfile', '/fraud': 'FraudFlag', '/duplicates': 'FraudFlag', '/disputes': 'Dispute', '/evaluations': 'Evaluation', '/offers': 'Offer', '/jobs': 'Job', '/plans': 'Plan', '/coupons': 'Coupon', '/payments': 'Payment', '/audit-logs': 'AuditLog', '/tickets': 'Ticket', '/broadcasts': 'Broadcast', '/questions': 'Question', '/applications': 'Application', '/employees': 'EmployeeProfile' };

export function FilterBar({ testId, params, set, search, filters, sorts, dates = true, onExport }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2" data-testid={`${testId}-filters`}>
      {search && <input className="input max-w-xs" placeholder="Search…" value={params.q || ''} data-testid={`${testId}-search`} onChange={(e) => set({ q: e.target.value })} />}
      {filters.map((f) => (f.type === 'number'
        ? <input key={f.name} type="number" className="input w-28" placeholder={f.label} value={params[f.name] || ''} data-testid={`${testId}-filter-${f.name}`} onChange={(e) => set({ [f.name]: e.target.value })} />
        : <select key={f.name} className="input max-w-[200px]" value={params[f.name] || ''} data-testid={`${testId}-filter-${f.name}`} onChange={(e) => set({ [f.name]: e.target.value })}><option value="">{f.label}: all</option>{f.options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}</select>))}
      {sorts && <select className="input max-w-[200px]" value={params.sort || ''} data-testid={`${testId}-sort`} onChange={(e) => set({ sort: e.target.value })}>{sorts.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}</select>}
      {dates && <>
        <label className="text-[11px] font-semibold text-slate-500">From<input type="date" className="input mt-0.5 h-10" value={params.from || ''} data-testid={`${testId}-from`} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-slate-500">To<input type="date" className="input mt-0.5 h-10" value={params.to || ''} data-testid={`${testId}-to`} onChange={(e) => set({ to: e.target.value })} /></label>
      </>}
      {Object.keys(params).some((k) => k !== 'page' && params[k]) && <button className="btn-ghost btn-sm h-10" onClick={() => set(null)} data-testid={`${testId}-clear-filters`}>Clear</button>}
      {onExport && <Button variant="secondary" className="ml-auto" onClick={onExport} data-testid={`${testId}-export`}><FileDown className="h-4 w-4" />Export CSV</Button>}
    </div>
  );
}

export default function ResourcePage({ title, subtitle, path, columns, actions, filters = [], sorts, search = true, testId, children, transform, model, onRowClick }) {
  const rec = useRecord();
  const [sp] = useSearchParams();
  const [params, setParams] = useState(() => ({ page: 1, ...Object.fromEntries(sp.entries()) }));
  const p = useDebounce(params);
  const { data, meta, loading, reload } = useFetch(() => adminService.list(path, p), [path, JSON.stringify(p), rec?.version]);
  const rows = inRange(transform ? transform(data) : data, params.from, params.to);
  const set = (patch) => setParams(patch ? { ...params, ...patch, page: 1 } : { page: 1 });
  const exportCsv = async () => {
    const { page, ...rest } = p;
    const r = await run(adminService.list(path, { ...rest, export: '1', limit: 5000, page: 1 }), 'Export ready');
    downloadCsv(inRange(transform ? transform(r.data) : r.data, params.from, params.to), title);
  };
  return (<div>
    <PageHeader title={title} subtitle={subtitle} actions={actions?.(reload)} />
    {children?.(reload)}
    <FilterBar testId={testId} params={params} set={set} search={search} filters={filters} sorts={sorts} onExport={exportCsv} />
    <Panel title={meta?.total != null ? `${meta.total} records` : undefined}><Table loading={loading} rows={rows} testId={testId} columns={columns(reload)} model={onRowClick ? undefined : model || MODEL_BY_PATH[path]} onRowClick={onRowClick} />
      {meta?.pages > 1 && <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-sm"><button className="btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => setParams({ ...params, page: meta.page - 1 })} data-testid={`${testId}-prev`}>Prev</button><span>{meta.page} / {meta.pages}</span><button className="btn-ghost btn-sm" disabled={meta.page >= meta.pages} onClick={() => setParams({ ...params, page: meta.page + 1 })} data-testid={`${testId}-next`}>Next</button></div>}
    </Panel>
  </div>);
}
