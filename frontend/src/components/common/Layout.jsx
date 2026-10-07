import { Link } from 'react-router-dom';
export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 data-testid="page-title" className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'text-ink', testId, to }) {
  const Wrap = to ? Link : 'div';
  return (
    <Wrap to={to} data-testid={testId} className={`card block p-5 ${to ? 'transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <div className={`mt-3 font-display text-3xl font-extrabold ${tone}`}>{value ?? '—'}</div>
      {to && <div className="mt-2 text-[11px] font-semibold text-brand">View →</div>}
    </Wrap>
  );
}

export function Panel({ title, actions, children, className = '', testId }) {
  return (
    <section data-testid={testId} className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => (
        <button key={t.value} data-testid={`tab-${t.value}`} onClick={() => onChange(t.value)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${value === t.value ? 'bg-ink text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{t.label}</button>
      ))}
    </div>
  );
}
