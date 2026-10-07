import { Inbox, Loader2 } from 'lucide-react';
import { useRecord } from '../../context/RecordContext';

const INTERACTIVE = 'button,a,input,select,textarea,label';

export default function Table({ columns, rows, loading, empty = 'Nothing here yet', testId = 'data-table', model }) {
  const rec = useRecord();
  const target = (r) => (typeof model === 'function' ? model(r) : model && [model, r._id || r.id]);
  const clickable = Boolean(rec && model);
  const onClick = (e, r) => {
    if (!clickable || e.target.closest(INTERACTIVE)) return;
    const t = target(r);
    if (t?.[1]) rec.open(t[0], t[1]);
  };
  if (loading) return <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!rows?.length) return <div data-testid={`${testId}-empty`} className="flex flex-col items-center gap-2 py-16 text-sm text-slate-400"><Inbox className="h-8 w-8" />{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table data-testid={testId} className="table-base">
        <thead><tr>{columns.map((c) => <th key={c.key || c.title}>{c.title}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._id || r.id || i} data-testid={`${testId}-row-${i}`} onClick={(e) => onClick(e, r)} className={clickable ? 'cursor-pointer transition-colors hover:bg-brand-light/40' : ''}>
              {columns.map((c) => <td key={c.key || c.title}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
