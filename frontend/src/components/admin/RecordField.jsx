import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fmtDateTime } from '../../utils/formatters';

const isComplex = (f) => !['String', 'Number', 'Boolean', 'Date', 'ObjectId'].includes(f.type);
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');

export function RecordValue({ field: f, value, onOpen }) {
  if (value === undefined || value === null || value === '') return <span className="text-slate-300">—</span>;
  if (f.ref && f.type === 'ObjectId') return <button onClick={() => onOpen(f.ref, value)} className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand hover:underline" data-testid={`ref-${f.path}`}>{f.ref} #{String(value).slice(-6)}<ExternalLink className="h-3 w-3" /></button>;
  if (f.ref && Array.isArray(value)) return <div className="flex flex-wrap gap-1">{value.map((v) => <button key={v} onClick={() => onOpen(f.ref, v)} className="font-mono text-xs text-brand hover:underline">#{String(v).slice(-6)}</button>)}</div>;
  if (f.type === 'Boolean') return <span className={value ? 'font-semibold text-emerald-600' : 'text-slate-500'}>{value ? 'Yes' : 'No'}</span>;
  if (f.type === 'Date') return fmtDateTime(value);
  if (typeof value === 'object') return <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(value, null, 1)}</pre>;
  return <span className="break-words">{String(value)}</span>;
}

function JsonInput({ value, onChange, path }) {
  const [text, setText] = useState(JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return <textarea rows={Math.min(12, text.split('\n').length + 1)} className={`input font-mono text-[11px] ${bad ? 'ring-2 ring-brand' : ''}`} value={text} data-testid={`edit-${path}`}
    onChange={(e) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); } }} />;
}

export function RecordField({ field: f, value, onChange }) {
  const tid = `edit-${f.path}`;
  if (isComplex(f)) return <JsonInput value={value} onChange={onChange} path={f.path} />;
  if (f.type === 'Boolean') return <input type="checkbox" className="h-4 w-4 accent-[#D7141A]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} data-testid={tid} />;
  if (f.enum) return <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid={tid}><option value="">—</option>{f.enum.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
  if (f.type === 'Number') return <input type="number" step="any" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} data-testid={tid} />;
  if (f.type === 'Date') return <input type="datetime-local" className="input" value={toLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} data-testid={tid} />;
  const long = String(value ?? '').length > 80;
  return long ? <textarea rows={4} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid={tid} /> : <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid={tid} />;
}
