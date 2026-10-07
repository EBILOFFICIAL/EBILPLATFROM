import { useState } from 'react';
import { Search } from 'lucide-react';
import JobCard from '../../components/jobs/JobCard';
import { useFetch } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { jobService } from '../../services/jobService';

export function JobBoard({ base = '/jobs' }) {
  const [f, setF] = useState({ q: '', location: '', type: '', experience: '', maxMinScore: '' });
  const q = useDebounce(f);
  const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== ''));
  const { data: jobs, loading } = useFetch(() => jobService.list(params), [JSON.stringify(params)]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <div className="card mb-8 grid gap-3 p-4 md:grid-cols-5">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input data-testid="jobs-search" className="input pl-9" placeholder="Role, skill or keyword" value={f.q} onChange={set('q')} /></div>
        <input data-testid="jobs-location" className="input" placeholder="Location" value={f.location} onChange={set('location')} />
        <select data-testid="jobs-type" className="input" value={f.type} onChange={set('type')}><option value="">Any type</option>{['full_time', 'part_time', 'contract', 'internship', 'remote'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
        <input data-testid="jobs-max-score" type="number" className="input" placeholder="My score (eligibility)" value={f.maxMinScore} onChange={set('maxMinScore')} />
      </div>
      {loading ? <p className="text-slate-400">Loading jobs…</p> : (
        <div className="grid gap-5 md:grid-cols-2">{(jobs || []).map((j) => <JobCard key={j._id} job={j} to={`${base}/${j._id}`} />)}{!jobs?.length && <p className="text-slate-400">No jobs match your filters.</p>}</div>
      )}
    </div>
  );
}

export default function Jobs() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="eyebrow">Score-gated jobs</div>
      <h1 data-testid="jobs-title" className="mt-3 text-4xl font-extrabold tracking-tight text-ink">Jobs from verified employers</h1>
      <p className="mb-10 mt-3 text-slate-500">Browse openly. Sign in with a PAN-verified profile to Easy Apply with one click.</p>
      <JobBoard />
    </div>
  );
}
