import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import Button from '../common/Button';
import { RecordField, RecordValue } from './RecordField';
import { useRecord, resolveModel, titleOf } from '../../context/RecordContext';
import { adminService as A } from '../../services/adminService';
import { fmtDateTime, run } from '../../utils/formatters';

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export default function RecordDrawer() {
  const ctx = useRecord();
  const top = ctx?.stack[ctx.stack.length - 1];
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('details');
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { setRec(null); setErr(''); A.get(`/data/${top.model}/${top.id}`).then(setRec).catch((e) => setErr(e.message)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (top) { load(); setTab('details'); setEdit(false); setDraft({}); setReason(''); } }, [top?.model, top?.id]);
  if (!top) return null;

  const save = async () => {
    setBusy(true);
    try { const r = await run(A.put(`/data/${top.model}/${top.id}`, { ...draft, _reason: reason })); setRec(r.data); setEdit(false); setDraft({}); ctx.changed(); } catch { /* toast */ } finally { setBusy(false); }
  };
  const remove = async () => {
    const why = window.prompt(`Delete this ${top.model}? This cannot be undone. Enter a reason:`);
    if (why === null) return;
    await run(A.del(`/data/${top.model}/${top.id}?reason=${encodeURIComponent(why)}`));
    ctx.changed(); ctx.back();
  };
  const openRef = (model, id) => ctx.push(model, id);
  const auditTarget = rec?.model === 'AuditLog' && resolveModel(ctx.models, rec.doc.entityType);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30 backdrop-blur-[2px]" onClick={ctx.close} data-testid="record-drawer-overlay">
      <aside onClick={(e) => e.stopPropagation()} data-testid="record-drawer" className="drawer-in flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-4">
          {ctx.stack.length > 1 && <button onClick={ctx.back} data-testid="record-drawer-back" className="mt-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{top.model}{rec?.readOnly && ' · read-only'}</div>
            <h2 className="truncate text-xl font-bold text-ink" data-testid="record-drawer-title">{rec ? titleOf(rec.doc) : 'Loading…'}</h2>
            <div className="font-mono text-[11px] text-slate-400">{top.id}</div>
          </div>
          {rec && !rec.readOnly && !edit && <Button size="sm" variant="secondary" onClick={() => setEdit(true)} data-testid="record-edit"><Pencil className="h-3.5 w-3.5" />Edit</Button>}
          {rec && !rec.readOnly && <Button size="sm" variant="ghost" onClick={remove} data-testid="record-delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
          <button onClick={ctx.close} data-testid="record-drawer-close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        {err && <p className="p-6 text-sm text-brand" data-testid="record-drawer-error">{err}</p>}
        {rec && <>
          <nav className="flex gap-1 border-b border-slate-100 px-6">
            {[['details', 'Details'], ['linked', `Linked (${rec.linked.reduce((a, l) => a + l.total, 0)})`], ['history', `History (${rec.history.length})`]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} data-testid={`record-tab-${k}`} className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${tab === k ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-ink'}`}>{l}</button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'details' && <>
              {auditTarget && rec.doc.entityId && <button onClick={() => openRef(auditTarget, rec.doc.entityId)} className="mb-4 flex items-center gap-1 text-sm font-semibold text-brand" data-testid="audit-open-entity"><ExternalLink className="h-4 w-4" />Open affected {auditTarget}</button>}
              {top.model === 'Evaluation' && edit && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Changing performance / professionalism / reliability / conduct (or answer points) recalculates the composite and instantly adjusts the employee's score. The change is sealed in the ledger.</p>}
              {top.model === 'EmployeeProfile' && edit && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Changing the current score posts an admin score event of the difference to the ledger and notifies the employee.</p>}
              <dl className="divide-y divide-slate-100">
                {rec.fields.map((f) => (
                  <div key={f.path} className="grid grid-cols-[180px_1fr] gap-3 py-2.5" data-testid={`record-field-${f.path}`}>
                    <dt className="break-words pt-1 text-xs font-semibold text-slate-500">{f.path}</dt>
                    <dd className="min-w-0 text-sm text-ink">{edit ? <RecordField field={f} value={f.path in draft ? draft[f.path] : get(rec.doc, f.path)} onChange={(v) => setDraft((d) => ({ ...d, [f.path]: v }))} /> : <RecordValue field={f} value={get(rec.doc, f.path)} onOpen={openRef} />}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-[180px_1fr] gap-3 py-2.5 text-xs text-slate-400"><dt>created / updated</dt><dd>{fmtDateTime(rec.doc.createdAt)} · {fmtDateTime(rec.doc.updatedAt)}</dd></div>
              </dl>
            </>}
            {tab === 'linked' && (rec.linked.length ? rec.linked.map((g) => (
              <section key={g.model} className="mb-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{g.model} <span className="text-slate-400">({g.total})</span></h4>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {g.items.map((it) => <li key={it._id}><button onClick={() => openRef(g.model, it._id)} data-testid={`linked-${g.model}-${it._id}`} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><span className="truncate font-medium text-ink">{titleOf(it)}</span><span className="shrink-0 text-xs text-slate-400">{it.status || ''} {fmtDateTime(it.createdAt)}</span></button></li>)}
                </ul>
              </section>
            )) : <p className="text-sm text-slate-400">No linked records.</p>)}
            {tab === 'history' && (rec.history.length ? <ol className="space-y-3">{rec.history.map((h) => (
              <li key={h._id} className="rounded-xl border border-slate-200 p-3" data-testid="record-history-item">
                <div className="flex justify-between gap-2 text-sm"><b className="text-ink">{h.action}</b><span className="text-xs text-slate-400">{fmtDateTime(h.createdAt)}</span></div>
                <div className="text-xs text-slate-500">{h.actorId?.name || 'system'} {h.actorRole ? `(${h.actorRole})` : ''}{h.meta?.reason ? ` · reason: ${h.meta.reason}` : ''}</div>
                {(h.before || h.after) && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify({ before: h.before, after: h.after }, null, 1)}</pre>}
              </li>
            ))}</ol> : <p className="text-sm text-slate-400">No recorded changes yet.</p>)}
          </div>
          {edit && <footer className="space-y-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <input className="input" placeholder="Reason for change (saved in audit log)" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="record-reason" />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setEdit(false); setDraft({}); }} data-testid="record-cancel">Cancel</Button><Button loading={busy} disabled={!Object.keys(draft).length} onClick={save} data-testid="record-save">Save changes</Button></div>
          </footer>}
        </>}
      </aside>
    </div>
  );
}
