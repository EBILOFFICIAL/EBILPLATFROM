import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';
import { useFetch } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import { jobService } from '../../services/jobService';
import { fmtInr, label, run } from '../../utils/formatters';

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: job } = useFetch(() => jobService.get(id), [id]);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  if (!job) return <div className="p-10 text-slate-400">Loading…</div>;
  const score = user?.profile?.currentScore;
  const eligible = score != null && score >= (job.minEibilScore || 0);
  const apply = async () => {
    if (!user) return nav(`/login?next=/employee/jobs/${id}`);
    setBusy(true);
    try { await run(jobService.apply(id, { answers: (job.screeningQuestions || []).map((q) => ({ question: q, answer: answers[q] || '' })) })); nav('/employee/applications'); } catch { /* shown */ } finally { setBusy(false); }
    return null;
  };
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="text-sm font-semibold text-slate-500">{job.employerId?.companyName} · {job.employerId?.city}</div>
      <h1 data-testid="job-title" className="mt-2 text-3xl font-extrabold text-ink">{job.title}</h1>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{job.location}</span><span>·</span><span>{label(job.type)}</span><span>·</span><span>{job.experienceMin}+ yrs</span><span>·</span><span>{fmtInr(job.salaryMin)} – {fmtInr(job.salaryMax)}</span>
        <span className="flex items-center gap-1 text-emerald-700"><ShieldCheck className="h-4 w-4" />Employer Trust Index {job.employerTrustIndex}</span>
      </div>
      <div className="card mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><div className="text-xs font-semibold uppercase text-slate-400">Minimum EIBIL score</div><div className="font-display text-3xl font-extrabold text-ink">{job.minEibilScore || 'Any'}</div></div>
          {user?.role === 'employee' && <div data-testid="job-eligibility" className={`rounded-full px-3 py-1 text-xs font-bold ${eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{eligible ? `You qualify (score ${score})` : `Requires ${job.minEibilScore}+ (you: ${score ?? 'unverified'})`}</div>}
        </div>
        {(job.screeningQuestions || []).map((q) => <div key={q} className="mt-4"><label className="label">{q}</label><input className="input" data-testid="job-screening-answer" value={answers[q] || ''} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} /></div>)}
        {(!user || user.role === 'employee') && <Button className="mt-6" onClick={apply} loading={busy} disabled={user && !eligible} data-testid="easy-apply-button">{user ? 'Easy Apply with EIBIL profile' : 'Login to apply'}</Button>}
        <p className="mt-3 text-xs text-slate-400">Applying shares your EIBIL report with this employer (pre-granted consent, revocable anytime). Salary/CTC is never shared.</p>
      </div>
      <div className="mt-8 whitespace-pre-line leading-relaxed text-slate-700">{job.description}</div>
      <div className="mt-6 flex flex-wrap gap-2">{(job.skills || []).map((s) => <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{s}</span>)}</div>
      <Link to={user?.role === 'employee' ? '/employee/jobs' : '/jobs'} className="btn-ghost mt-8">← All jobs</Link>
    </div>
  );
}
