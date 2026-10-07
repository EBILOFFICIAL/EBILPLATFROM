import { useMemo, useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { useFetch } from '../../hooks/usePagination';
import { employerService } from '../../services/employerService';
import { label, run } from '../../utils/formatters';

const DIMS = ['performance', 'professionalism', 'reliability', 'conduct'];

function Choice({ q, value, onPick }) {
  const pill = q.type === 'rating';
  return (
    <div className={pill ? 'grid grid-cols-5 gap-1.5' : 'flex flex-wrap gap-2'}>
      {q.options.map((o, i) => (
        <button type="button" key={i} onClick={() => onPick(i)} data-testid={`answer-${q._id}-${i}`} title={o.label}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${value === i ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand'}`}>
          {pill ? <><span className="block text-sm">{i + 1}</span><span className="hidden font-normal sm:block">{o.label.replace(/^\d - /, '')}</span></> : o.label}
        </button>
      ))}
    </div>
  );
}

export default function EvaluationForm({ roster, onClose, onDone }) {
  const { data: questions, loading } = useFetch(() => employerService.questionnaire(), []);
  const [recordId, setRecordId] = useState('');
  const [period, setPeriod] = useState('');
  const [comments, setComments] = useState('');
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const qs = questions || [];

  const dims = useMemo(() => Object.fromEntries(DIMS.map((d) => {
    const rows = qs.filter((q) => q.dimension === d && answers[q._id] !== undefined);
    const w = rows.reduce((s, q) => s + q.weight, 0);
    return [d, w ? Math.round(rows.reduce((s, q) => s + q.options[answers[q._id]].points * q.weight, 0) / w) : null];
  })), [qs, answers]);
  const answered = Object.keys(answers).length;
  const complete = qs.length > 0 && answered === qs.length;

  const submit = async (submitNow) => {
    setBusy(true);
    try {
      await run(employerService.createEvaluation({ employmentRecordId: recordId, ...(period ? { period } : {}), comments, submit: submitNow, answers: Object.entries(answers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })) }));
      onDone(); onClose();
    } catch { /* toast */ } finally { setBusy(false); }
  };

  return (<Modal open onClose={onClose} title="New evaluation" wide testId="evaluation-modal">
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Employee *</span><select className="input" value={recordId} onChange={(e) => setRecordId(e.target.value)} data-testid="evaluation-modal-employmentRecordId"><option value="">Select…</option>{roster.map((r) => <option key={r._id} value={r._id}>{r.employeeId?.fullName} – {r.designation}</option>)}</select></label>
      <label><span className="label">Period (blank = current)</span><input className="input" placeholder="e.g. 2026-Q3" value={period} onChange={(e) => setPeriod(e.target.value)} data-testid="evaluation-modal-period" /></label>
    </div>
    <div className="sticky top-0 z-10 -mx-6 mt-5 grid grid-cols-4 gap-2 border-y border-slate-100 bg-white/95 px-6 py-3 backdrop-blur" data-testid="evaluation-live-dims">
      {DIMS.map((d) => <div key={d} className="text-center"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{d}</div><div className="font-mono text-lg font-extrabold text-ink" data-testid={`live-dim-${d}`}>{dims[d] ?? '—'}</div></div>)}
    </div>
    {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading questionnaire…</p> : DIMS.map((d) => {
      const rows = qs.filter((q) => q.dimension === d);
      if (!rows.length) return null;
      return (<section key={d} className="mt-5" data-testid={`evaluation-section-${d}`}>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand">{label(d)}</h4>
        <ol className="space-y-4">{rows.map((q) => (
          <li key={q._id} data-testid={`question-${q._id}`}>
            <p className="mb-2 text-sm font-medium text-ink">{q.text}</p>
            {q.helpText && <p className="-mt-1 mb-2 text-xs text-slate-400">{q.helpText}</p>}
            <Choice q={q} value={answers[q._id]} onPick={(i) => setAnswers((a) => ({ ...a, [q._id]: i }))} />
          </li>
        ))}</ol>
      </section>);
    })}
    <label className="mt-6 block"><span className="label">Factual comments</span><textarea className="input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} data-testid="evaluation-modal-comments" /></label>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <span className="text-xs text-slate-500" data-testid="evaluation-progress">{answered}/{qs.length} answered</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!recordId || busy} onClick={() => submit(false)} data-testid="evaluation-save-draft">Save draft</Button>
        <Button disabled={!recordId || !complete} loading={busy} onClick={() => submit(true)} data-testid="evaluation-modal-submit">Submit evaluation</Button>
      </div>
    </div>
  </Modal>);
}
