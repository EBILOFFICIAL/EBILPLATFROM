import { label as lbl } from '../../utils/formatters';

export function Field({ label, name, type = 'text', value, onChange, options, required, placeholder, hint, rows, testId, ...rest }) {
  const id = testId || `field-${name}`;
  const common = { id, name, 'data-testid': id, required, placeholder, className: 'input', ...rest };
  let control;
  if (type === 'select') {
    control = (
      <select {...common} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{lbl(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    );
  } else if (type === 'textarea') control = <textarea {...common} rows={rows || 3} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} />;
  else if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input type="checkbox" data-testid={id} checked={Boolean(value)} onChange={(e) => onChange(name, e.target.checked)} className="h-4 w-4 accent-[#D7141A]" />
        {label}
      </label>
    );
  } else control = <input {...common} type={type} value={value ?? ''} onChange={(e) => onChange(name, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />;
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="text-brand"> *</span>}</label>}
      {control}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default Field;
