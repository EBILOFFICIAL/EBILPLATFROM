import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import CmsPage from './CmsPage';
import { useFetch } from '../../hooks/usePagination';
import { publicService } from '../../services/jobService';
import { fmtInr } from '../../utils/formatters';

export default function Pricing() {
  const { data: plans } = useFetch(() => publicService.plans(), []);
  return (
    <CmsPage slug="pricing">
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {(plans || []).map((p) => (
          <div key={p._id} data-testid={`plan-${p.code}`} className={`card p-8 ${p.highlighted ? 'ring-2 ring-brand' : ''}`}>
            {p.highlighted && <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">Most popular</span>}
            <h3 className="mt-3 text-xl font-bold text-ink">{p.name}</h3>
            <div className="mt-3 font-display text-4xl font-extrabold text-ink">{p.priceInr ? fmtInr(p.priceInr) : 'Free'}<span className="text-sm font-medium text-slate-400">{p.billingCycle === 'monthly' && p.priceInr ? ' / month' : ''}</span></div>
            <ul className="mt-6 space-y-2.5">{p.features.map((f) => <li key={f} className="flex gap-2 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-600" />{f}</li>)}</ul>
            <Link to="/register?role=employer" className={`${p.highlighted ? 'btn-primary' : 'btn-secondary'} mt-8 w-full`}>Get started</Link>
          </div>
        ))}
      </div>
    </CmsPage>
  );
}
