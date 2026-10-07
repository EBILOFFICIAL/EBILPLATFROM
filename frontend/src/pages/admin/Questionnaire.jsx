import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { useFetch } from '../../hooks/usePagination';
import { adminService as A } from '../../services/adminService';
import { label, run } from '../../utils/formatters';

const DIMS = ['performance', 'professionalism', 'reliability', 'conduct'];
const PRESETS = {
  rating: [['1 - Poor', 10], ['2 - Below expectations', 45], ['3 - Meets expectations', 75], ['4 - Exceeds expectations', 88], ['5 - Outstanding', 100]],
  yes_no: [['Yes', 100], ['No', 0]],
  mcq: [['Option A', 100], ['Option B', 50], ['Option C', 0]],
};
const preset = (t) => PRESETS[t].map(([l, p]) => ({ label: l, points: p }));
const TYPE_LABEL = { rating: 'Rating 1–5', yes_no: 'Yes / No', mcq: 'Multiple choice' };

function QuestionEditor({ value, onClose, onSaved }) {
  const [q, setQ] = useState(value);
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));
  const setOpt = (i, k, v) => set('options', q.options.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  const save = async () => {
    const { _id, createdAt, updatedAt, __v, ...body } = q;
    await run(_id ? A.put(`/questions/${_id}`, body) : A.post('/questions', body));
    onSaved(); onClose();
  };
  return (<Modal open onClose={onClose} title={q._id ? 'Edit question' : 'New question'} wide testId="question-editor">
    <div className="space-y-4">
      <label className="block"><span className="label">Question</span><textarea className="input" rows={2} value={q.text} onChange={(e) => set('text', e.target.value)} data-testid="question-text" /></label>
      <label className="block"><span className="label">Help text (optional)</span><input className="input" value={q.helpText || ''} onChange={(e) => set('helpText', e.target.value)} data-testid="question-help" /></label>
      <div className="grid gap-4 sm:grid-cols-4">
        <label><span className="label">Dimension</span><select className="input" value={q.dimension} onChange={(e) => set('dimension', e.target.value)} data-testid="question-dimension">{DIMS.map((d) => <option key={d} value={d}>{label(d)}</option>)}</select></label>
        <label><span className="label">Answer type</span><select className="input" value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value, options: preset(e.target.value) })} data-testid="question-type">{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="label">Weight</span><input type="number" step="0.5" min="0.1" max="10" className="input" value={q.weight} onChange={(e) => set('weight', Number(e.target.value))} data-testid="question-weight" /></label>
        <label><span className="label">Order</span><input type="number" className="input" value={q.order} onChange={(e) => set('order', Number(e.target.value))} data-testid="question-order" /></label>
      </div>
      <div>
        <div className="label">Answers & points (0–100)</div>
        <div className="space-y-2">{q.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2" data-testid={`question-option-${i}`}>
            <input className="input flex-1" value={o.label} onChange={(e) => setOpt(i, 'label', e.target.value)} disabled={q.type === 'yes_no'} data-testid={`question-option-label-${i}`} />
            <input type="number" min="0" max="100" className="input w-24 text-right font-mono" value={o.points} onChange={(e) => setOpt(i, 'points', Number(e.target.value))} data-testid={`question-option-points-${i}`} />
            {q.type === 'mcq' && q.options.length > 2 && <button onClick={() => set('options', q.options.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" data-testid={`question-option-remove-${i}`}><X className="h-4 w-4" /></button>}
          </div>
        ))}</div>
        {q.type === 'mcq' && <Button size="sm" variant="ghost" className="mt-2" onClick={() => set('options', [...q.options, { label: `Option ${String.fromCharCode(65 + q.options.length)}`, points: 50 }])} data-testid="question-add-option"><Plus className="h-4 w-4" />Add option</Button>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#D7141A]" checked={q.active} onChange={(e) => set('active', e.target.checked)} data-testid="question-active" />Active (asked in new evaluations)</label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!q.text?.trim()} data-testid="question-save">Save question</Button></div>
    </div>
  </Modal>);
}

export default function AdminQuestionnaire() {
  const { data, reload } = useFetch(() => A.get('/questions', { limit: 100 }), []);
  const [edit, setEdit] = useState(null);
  const blank = (dimension = 'performance') => ({ text: '', helpText: '', dimension, type: 'rating', weight: 1, order: (data?.length || 0) + 1, active: true, options: preset('rating') });
  const remove = async (q) => { if (window.confirm(`Delete "${q.text}"? Past evaluations keep their saved answers.`)) { await run(A.del(`/questions/${q._id}`)); reload(); } };
  return (<div>
    <PageHeader title="Evaluation questionnaire" subtitle="Employers answer these questions in every evaluation. Each answer's points feed its dimension score, which then feeds the score algorithm. Changes apply to new evaluations immediately." actions={<Button onClick={() => setEdit(blank())} data-testid="question-new"><Plus className="h-4 w-4" />Add question</Button>} />
    <div className="grid gap-5 lg:grid-cols-2">{DIMS.map((d) => {
      const rows = (data || []).filter((q) => q.dimension === d);
      return (<Panel key={d} title={`${label(d)} · ${rows.filter((q) => q.active).length} active`} testId={`questions-${d}`} actions={<button onClick={() => setEdit(blank(d))} className="text-xs font-semibold text-brand" data-testid={`question-new-${d}`}>+ Add</button>}>
        <ul className="divide-y divide-slate-100">{rows.map((q) => (
          <li key={q._id} className="flex items-start gap-3 px-5 py-3.5" data-testid={`question-row-${q._id}`}>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${q.active ? 'text-ink' : 'text-slate-400 line-through'}`}>{q.text}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{TYPE_LABEL[q.type]}</span><span>weight {q.weight}</span><span className="truncate">{q.options.map((o) => `${o.label.replace(/^\d - /, '')}=${o.points}`).join(' · ')}</span>{!q.active && <StatusBadge status="inactive" />}</div>
            </div>
            <button onClick={() => setEdit(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" data-testid={`question-edit-${q._id}`}><Pencil className="h-4 w-4" /></button>
            <button onClick={() => remove(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand" data-testid={`question-delete-${q._id}`}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}{!rows.length && <li className="px-5 py-6 text-sm text-slate-400">No questions. This dimension falls back to the neutral rating.</li>}</ul>
      </Panel>);
    })}</div>
    {edit && <QuestionEditor value={edit} onClose={() => setEdit(null)} onSaved={reload} />}
  </div>);
}
