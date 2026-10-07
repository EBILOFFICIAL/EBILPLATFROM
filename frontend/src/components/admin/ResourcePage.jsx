import { useState } from 'react';
import { PageHeader, Panel } from '../common/Layout';
import Table from '../common/Table';
import { useFetch } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { adminService } from '../../services/adminService';

export default function ResourcePage({ title, subtitle, path, columns, actions, filters = [], search = true, testId, children, transform }) {
  const [params, setParams] = useState({ page: 1 });
  const p = useDebounce(params);
  const { data, meta, loading, reload } = useFetch(() => adminService.list(path, p), [path, JSON.stringify(p)]);
  const rows = transform ? transform(data) : data;
  return (<div>
    <PageHeader title={title} subtitle={subtitle} actions={actions?.(reload)} />
    {children?.(reload)}
    {(search || filters.length > 0) && <div className="mb-4 flex flex-wrap gap-2">
      {search && <input className="input max-w-xs" placeholder="Search…" data-testid={`${testId}-search`} onChange={(e) => setParams({ ...params, q: e.target.value, page: 1 })} />}
      {filters.map((f) => <select key={f.name} className="input max-w-[200px]" data-testid={`${testId}-filter-${f.name}`} onChange={(e) => setParams({ ...params, [f.name]: e.target.value, page: 1 })}><option value="">{f.label}: all</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
    </div>}
    <Panel><Table loading={loading} rows={rows} testId={testId} columns={columns(reload)} />
      {meta?.pages > 1 && <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-sm"><button className="btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => setParams({ ...params, page: meta.page - 1 })}>Prev</button><span>{meta.page} / {meta.pages}</span><button className="btn-ghost btn-sm" disabled={meta.page >= meta.pages} onClick={() => setParams({ ...params, page: meta.page + 1 })}>Next</button></div>}
    </Panel>
  </div>);
}
