import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, Save } from 'lucide-react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Button from '../../components/common/Button';
import { useFetch } from '../../hooks/usePagination';
import { adminService as A } from '../../services/adminService';
import { label, run } from '../../utils/formatters';

const DIMS = ['performance', 'professionalism', 'reliability', 'conduct'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const set = (obj, path, v) => { const c = structuredClone(obj); path.reduce((o, k, i) => { if (i === path.length - 1) o[k] = v; return o[k]; }, c); return c; };

function Num({ value, onChange, testId, step = 'any' }) {
  return <input type="number" step={step} className="input h-9 w-24 text-right font-mono text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} data-testid={testId} />;
}

function Group({ obj, path, onChange, prefix }) {
  return (<div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
    {Object.entries(obj || {}).map(([k, v]) => (typeof v === 'object' && v !== null
      ? <div key={k} className="sm:col-span-2"><div className="mb-1 text-xs font-semibold text-slate-500">{label(k)}</div><div className="rounded-lg bg-slate-50 p-3"><Group obj={v} path={[...path, k]} onChange={onChange} prefix={`${prefix}-${k}`} /></div></div>
      : <label key={k} className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{label(k)}</span>{typeof v === 'boolean' ? <input type="checkbox" className="h-4 w-4 accent-[#D7141A]" checked={v} onChange={(e) => onChange([...path, k], e.target.checked)} data-testid={`${prefix}-${k}`} /> : <Num value={v} onChange={(x) => onChange([...path, k], x)} testId={`${prefix}-${k}`} />}</label>))}
  </div>);
}

function Step({ n, title, formula, children }) {
  return (<div className="card relative p-5" data-testid={`algo-step-${n}`}>
    <div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{n}</span><h3 className="font-bold text-ink">{title}</h3></div>
    <code className="mt-3 block rounded-lg bg-ink px-3 py-2 font-mono text-[12px] leading-relaxed text-white">{formula}</code>
    <div className="mt-4 space-y-2">{children}</div>
  </div>);
}

const Row = ({ label: l, children }) => <div className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{l}</span>{children}</div>;

function Simulator({ cfg }) {
  const [s, setS] = useState({ performance: 85, professionalism: 80, reliability: 80, conduct: 90, tier: 'standard', age: 0, current: cfg.baseline });
  const r = useMemo(() => {
    const total = DIMS.reduce((a, d) => a + Number(cfg.weights[d] || 0), 0) || 1;
    const composite = DIMS.reduce((a, d) => a + s[d] * Number(cfg.weights[d] || 0), 0) / total;
    const raw = (composite - cfg.neutralComposite) * cfg.sensitivityK;
    const capped = clamp(raw, -cfg.cycleCap, cfg.cycleCap);
    const weight = (cfg.trustTierWeights?.[s.tier] ?? 1) * 0.5 ** (s.age / (cfg.recencyHalfLifeMonths || 1));
    const delta = Math.round(capped * weight);
    const next = clamp(Number(s.current) + delta, cfg.min, cfg.max);
    const band = (cfg.bands || []).find((b) => next >= b.min && next <= b.max)?.name;
    return { composite: composite.toFixed(2), raw: raw.toFixed(2), capped: capped.toFixed(2), weight: weight.toFixed(3), delta, next, band };
  }, [s, cfg]);
  const u = (k) => (e) => setS({ ...s, [k]: e.target.type === 'range' || e.target.type === 'number' ? Number(e.target.value) : e.target.value });
  return (<Panel title="Try it: evaluation simulator" testId="algo-simulator">
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <div className="space-y-3">
        {DIMS.map((d) => <div key={d}><div className="flex justify-between text-sm"><span className="capitalize text-slate-600">{d}</span><b className="font-mono">{s[d]}</b></div><input type="range" min="0" max="100" value={s[d]} onChange={u(d)} className="w-full accent-[#D7141A]" data-testid={`sim-${d}`} /></div>)}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <label className="text-xs text-slate-500">Employer tier<select className="input mt-1" value={s.tier} onChange={u('tier')} data-testid="sim-tier">{Object.keys(cfg.trustTierWeights || {}).map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-slate-500">Age (months)<input type="number" className="input mt-1" value={s.age} onChange={u('age')} data-testid="sim-age" /></label>
          <label className="text-xs text-slate-500">Current score<input type="number" className="input mt-1" value={s.current} onChange={u('current')} data-testid="sim-current" /></label>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-50 p-5 font-mono text-sm">
        {[['Composite', r.composite], ['Raw change', r.raw], [`Capped (±${cfg.cycleCap})`, r.capped], ['Weight (trust × recency)', r.weight]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-200 py-2"><span className="font-sans text-slate-500">{k}</span><b>{v}</b></div>)}
        <div className="flex items-end justify-between pt-4"><div><div className="font-sans text-xs text-slate-500">Score change</div><div className={`text-3xl font-extrabold ${r.delta >= 0 ? 'text-emerald-600' : 'text-brand'}`} data-testid="sim-delta">{r.delta > 0 ? '+' : ''}{r.delta}</div></div><ArrowRight className="mb-2 h-5 w-5 text-slate-300" /><div className="text-right"><div className="font-sans text-xs text-slate-500">New score</div><div className="text-3xl font-extrabold text-ink" data-testid="sim-new-score">{r.next}</div><div className="font-sans text-xs text-slate-500">{r.band}</div></div></div>
      </div>
    </div>
  </Panel>);
}

export default function AdminAlgorithm() {
  const { data, reload } = useFetch(() => A.get('/score/algorithm'), []);
  const [cfg, setCfg] = useState(null);
  const [notes, setNotes] = useState('');
  useEffect(() => { if (data) setCfg(structuredClone(data.config)); }, [data]);
  if (!cfg) return <PageHeader title="Score algorithm" subtitle="Loading…" />;
  const ch = (path, v) => setCfg((c) => set(c, path, v));
  const dirty = JSON.stringify(cfg) !== JSON.stringify(data.config);
  const save = async () => { const { version, ...params } = cfg; await run(A.post('/score-config/apply', { ...params, notes: notes || 'Edited in algorithm console' })); setNotes(''); reload(); };
  const qCount = (d) => data.questions.filter((q) => q.dimension === d && q.active).length;
  return (<div>
    <PageHeader eyebrow={`Live version v${data.config.version}`} title="Score algorithm" subtitle="The complete EIBIL scoring formula. Edit any value. Changes go live instantly, are versioned, recorded in the audit log and sealed in the ledger." actions={<>
      <input className="input w-56" placeholder="Change note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="algo-notes" />
      <Button variant="secondary" disabled={!dirty} onClick={() => setCfg(structuredClone(data.config))} data-testid="algo-reset"><RotateCcw className="h-4 w-4" />Reset</Button>
      <Button disabled={!dirty} onClick={save} data-testid="algo-save"><Save className="h-4 w-4" />Apply changes</Button></>} />
    {dirty && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="algo-dirty">You have unsaved changes. Click <b>Apply changes</b> to make them live.</div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <Step n={1} title="Questionnaire → dimension scores" formula="dimension = Σ(answer points × question weight) / Σ(question weight)">
        <p className="text-sm text-slate-600">Employers answer the questionnaire. Each answer has points from 0 to 100, and each question has a weight.</p>
        {DIMS.map((d) => <Row key={d} label={<span className="capitalize">{d}</span>}><span className="text-sm font-semibold">{qCount(d)} active questions</span></Row>)}
        <Link to="/admin/questionnaire" className="inline-block pt-1 text-sm font-semibold text-brand" data-testid="algo-edit-questions">Edit questions →</Link>
      </Step>
      <Step n={2} title="Composite rating" formula="composite = Σ(dimension × dimension weight) / Σ(weights)">
        {DIMS.map((d) => <Row key={d} label={<span className="capitalize">{d} weight</span>}><Num value={cfg.weights[d]} onChange={(v) => ch(['weights', d], v)} testId={`algo-weight-${d}`} /></Row>)}
      </Step>
      <Step n={3} title="Raw change & cap" formula="raw = (composite − neutral) × k;  capped = clamp(raw, −cap, +cap)">
        <Row label="Neutral composite (no change at this rating)"><Num value={cfg.neutralComposite} onChange={(v) => ch(['neutralComposite'], v)} testId="algo-neutral" /></Row>
        <Row label="Sensitivity k (points per composite point)"><Num value={cfg.sensitivityK} onChange={(v) => ch(['sensitivityK'], v)} testId="algo-k" /></Row>
        <Row label="Cycle cap (max ± per evaluation)"><Num value={cfg.cycleCap} onChange={(v) => ch(['cycleCap'], v)} testId="algo-cap" /></Row>
      </Step>
      <Step n={4} title="Employer trust & recency weighting" formula="change = round(capped × trustWeight[tier] × 0.5^(ageMonths / halfLife))">
        {Object.keys(cfg.trustTierWeights || {}).map((t) => <Row key={t} label={`Trust weight: ${t}`}><Num value={cfg.trustTierWeights[t]} onChange={(v) => ch(['trustTierWeights', t], v)} testId={`algo-trust-${t}`} /></Row>)}
        <Row label="Recency half-life (months)"><Num value={cfg.recencyHalfLifeMonths} onChange={(v) => ch(['recencyHalfLifeMonths'], v)} testId="algo-halflife" /></Row>
      </Step>
      <Step n={5} title="Score, range & bands" formula="score = clamp(previous + change, min, max); new profile = baseline">
        <Row label="Baseline (new verified profile)"><Num value={cfg.baseline} onChange={(v) => ch(['baseline'], v)} testId="algo-baseline" /></Row>
        <Row label="Minimum score"><Num value={cfg.min} onChange={(v) => ch(['min'], v)} testId="algo-min" /></Row>
        <Row label="Maximum score"><Num value={cfg.max} onChange={(v) => ch(['max'], v)} testId="algo-max" /></Row>
        <div className="space-y-1.5 pt-2">{(cfg.bands || []).map((b, i) => <div key={i} className="flex items-center gap-2" data-testid={`algo-band-${i}`}>
          <input className="input h-9 flex-1 text-sm" value={b.name} onChange={(e) => ch(['bands', i, 'name'], e.target.value)} />
          <Num value={b.min} onChange={(v) => ch(['bands', i, 'min'], v)} /><span className="text-slate-400">–</span><Num value={b.max} onChange={(v) => ch(['bands', i, 'max'], v)} />
        </div>)}</div>
      </Step>
      <Step n={6} title="Exit & notice rules" formula="exit change = notice/handover rules (neutral exits are never penalised)">
        <Group obj={cfg.exitRules} path={['exitRules']} onChange={ch} prefix="algo-exit" />
      </Step>
    </div>
    <Panel title="Event rules (offers, tenure, decay, alerts, review windows)" className="mt-5" testId="algo-events"><div className="p-5"><Group obj={cfg.events} path={['events']} onChange={ch} prefix="algo-event" /></div></Panel>
    <div className="mt-5"><Simulator cfg={cfg} /></div>
  </div>);
}
