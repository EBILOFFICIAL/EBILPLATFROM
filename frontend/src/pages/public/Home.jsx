import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ScanSearch, Gauge, Sparkles, CheckCircle2, ArrowRight, ChevronDown, Quote, BadgeCheck, Building2, UserRound, Lock } from 'lucide-react';
import { useFetch } from '../../hooks/usePagination';
import { publicService } from '../../services/jobService';
import { bandColor } from '../../utils/formatters';

const ICONS = { ShieldCheck, ScanSearch, Gauge, Sparkles };

function SampleCard({ profiles }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % profiles.length), 4500); return () => clearInterval(t); }, [profiles.length]);
  const p = profiles[i];
  const pct = ((p.score - 300) / 650) * 100;
  return (
    <div data-testid="hero-sample-card" className="card fade-up relative w-full max-w-md p-6" style={{ animationDelay: '.15s' }}>
      <div className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Live sample profile</div>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light font-display text-xl font-extrabold text-brand">{p.name.split(' ').map((n) => n[0]).join('')}</div>
        <div className="flex-1"><div className="font-bold text-ink">{p.name}</div><div className="text-xs text-slate-500">{p.role}</div></div>
        <BadgeCheck className="h-6 w-6 text-emerald-600" />
      </div>
      <div className="mt-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">EIBIL Score</div>
          <div data-testid="sample-score" className="font-display text-6xl font-extrabold tracking-tight transition-colors" style={{ color: bandColor(p.score) }}>{p.score}</div>
        </div>
        <div className="mb-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{p.band}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-blue-500 to-emerald-600"><div className="h-full bg-white/70 transition-[margin] duration-700" style={{ marginLeft: `${pct}%` }} /></div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>300</span><span>950</span></div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase text-slate-400">Background</div><div className="mt-1 flex items-center gap-1 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{p.background}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase text-slate-400">Integrity rating</div><div className="mt-1 text-sm font-bold text-ink">{p.integrity}</div></div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="text-[10px] font-semibold uppercase text-slate-400">Verified work history</div>
        {p.history.map((h) => <div key={h.company} className="flex justify-between text-sm"><span className="font-medium text-slate-700">{h.company}</span><span className="text-slate-400">{h.years}</span></div>)}
      </div>
      <div className="mt-5 flex justify-center gap-1.5">{profiles.map((_, k) => <button key={k} data-testid={`sample-dot-${k}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-[width,background-color] ${k === i ? 'w-6 bg-brand' : 'w-1.5 bg-slate-300'}`} />)}</div>
    </div>
  );
}

function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((f, i) => (
        <div key={f.q}>
          <button data-testid={`faq-item-${i}`} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-6 py-5 text-left font-semibold text-ink">{f.q}<ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} /></button>
          {open === i && <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { data: page } = useFetch(() => publicService.cms('home'), []);
  const c = page?.content;
  if (!c) return <div className="h-screen" />;
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:py-28">
          <div className="fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-brand-light px-3 py-1 text-xs font-bold text-brand"><ShieldCheck className="h-3.5 w-3.5" />{c.hero.badge}</span>
            <h1 data-testid="hero-title" className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">{c.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{c.hero.subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register" data-testid="hero-start-verification" className="btn-primary px-6 py-3 text-base">{c.hero.primaryCta}<ArrowRight className="h-4 w-4" /></Link>
              <Link to="/contact?type=demo" data-testid="hero-schedule-demo" className="btn-secondary px-6 py-3 text-base">{c.hero.secondaryCta}</Link>
            </div>
            <div className="mt-12 grid max-w-xl grid-cols-2 gap-6 sm:grid-cols-4">
              {c.stats.map((s) => <div key={s.label}><div className="font-display text-2xl font-extrabold text-ink">{s.value}</div><div className="mt-1 text-xs text-slate-500">{s.label}</div></div>)}
            </div>
          </div>
          <div className="flex justify-center lg:justify-end"><SampleCard profiles={c.sampleProfiles} /></div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/70 py-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">{c.trustedBy.map((n) => <span key={n} className="font-display text-lg font-bold text-slate-400">{n}</span>)}</div>
          <p className="mt-4 text-center text-[11px] text-slate-400">{c.trustedNote}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="eyebrow">How it works</div>
        <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Three steps to a verified, living career score</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {c.steps.map((s, i) => (
            <div key={s.title} data-testid={`step-${i + 1}`} className="card relative p-8">
              <div className="font-mono text-5xl font-bold text-slate-100">0{i + 1}</div>
              <h3 className="mt-2 text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.body}</p>
              {i < 2 && <ArrowRight className="absolute -right-5 top-1/2 hidden h-6 w-6 text-brand md:block" />}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Intelligence Engine</div>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Bureau-grade signals, governed by rules you can read</h2>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {c.engine.map((t) => { const I = ICONS[t.icon] || Sparkles; return (
              <div key={t.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition-colors hover:bg-white/[0.08]">
                <I className="h-7 w-7 text-brand" /><h3 className="mt-5 text-lg font-bold">{t.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{t.body}</p>
              </div>
            ); })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-24 md:grid-cols-2 lg:px-8">
        {[['For Employers', Building2, c.forEmployers, '/register?role=employer', 'Start verifying'], ['For Employees', UserRound, c.forEmployees, '/register', 'Claim your profile']].map(([t, I, items, to, cta]) => (
          <div key={t} className="card p-10">
            <I className="h-8 w-8 text-brand" /><h3 className="mt-5 text-2xl font-extrabold text-ink">{t}</h3>
            <ul className="mt-6 space-y-3">{items.map((x) => <li key={x} className="flex gap-3 text-sm text-slate-600"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />{x}</li>)}</ul>
            <Link to={to} className="btn-dark mt-8">{cta}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        ))}
      </section>

      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="eyebrow">Voices</div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {c.testimonials.map((t) => <figure key={t.quote} className="card p-8"><Quote className="h-6 w-6 text-brand" /><blockquote className="mt-4 text-sm leading-relaxed text-slate-700">“{t.quote}”</blockquote><figcaption className="mt-6 text-sm font-bold text-ink">{t.name}<span className="block text-xs font-normal text-slate-500">{t.company}</span></figcaption></figure>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <div className="eyebrow">FAQ</div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">Questions, answered</h2>
          <ul className="mt-8 space-y-3">{c.compliance.map((x) => <li key={x} className="flex gap-3 text-sm text-slate-600"><Lock className="h-4 w-4 shrink-0 text-brand" />{x}</li>)}</ul>
        </div>
        <Faq items={c.faq} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand px-10 py-16 text-white">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
          <h2 className="relative max-w-xl text-3xl font-extrabold sm:text-4xl">{c.cta.title}</h2>
          <p className="relative mt-4 max-w-xl text-red-100">{c.cta.body}</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link to="/register" data-testid="cta-start" className="btn bg-white px-6 py-3 text-brand hover:bg-red-50">{c.hero.primaryCta}</Link>
            <Link to="/contact?type=demo" data-testid="cta-demo" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">{c.hero.secondaryCta}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
