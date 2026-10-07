import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Download } from 'lucide-react';
import ScoreGauge from '../../components/common/ScoreGauge';
import ScoreTrend from '../../components/charts/ScoreTrend';
import { PageHeader, Panel } from '../../components/common/Layout';
import Button from '../../components/common/Button';
import VerifyPAN from '../auth/VerifyPAN';
import { useAuth } from '../../hooks/useAuth';
import { useFetch } from '../../hooks/usePagination';
import { employeeService } from '../../services/employeeService';
import { run } from '../../utils/formatters';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const p = user.profile;
  const { data: score, error } = useFetch(() => (p?.panVerified ? employeeService.score() : Promise.resolve(null)), [p?.panVerified]);
  const { data: emps } = useFetch(() => employeeService.employments(), []);
  const checks = [['Email verified', user.emailVerified], ['Mobile verified', user.mobileVerified], ['PAN verified', p?.panVerified], ['Employment verified', emps?.some((e) => e.status === 'verified')]];
  return (
    <div>
      <PageHeader eyebrow="Career Hub" title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Your verified employment identity, score and history in one place." actions={p?.panVerified && <Button variant="secondary" onClick={() => run(employeeService.downloadReport(), 'Report downloaded')} data-testid="download-report"><Download className="h-4 w-4" />Download EIBIL report</Button>} />
      {!p?.panVerified && <Panel title="Verify your PAN to activate your score" className="mb-6 p-6" testId="pan-panel"><div className="p-5"><VerifyPAN /></div></Panel>}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="EIBIL score" testId="score-panel"><div className="flex justify-center p-6">{score ? <ScoreGauge score={score.score} band={score.band} asOf={score.asOf} /> : <p className="py-10 text-center text-sm text-slate-400">{error || 'Score appears after email + PAN verification.'}</p>}</div></Panel>
        <Panel title="Score trend" actions={<Link to="/employee/score" className="text-xs font-semibold text-brand">What moved my score →</Link>}><div className="p-5">{score ? <ScoreTrend data={score.trend} /> : <p className="text-sm text-slate-400">No score history yet.</p>}</div></Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Dimension ratings (avg of accepted evaluations)">
          <div className="space-y-4 p-5">{['performance', 'professionalism', 'reliability', 'conduct'].map((d) => { const v = score?.dimensions?.[d]; return (
            <div key={d} data-testid={`dimension-${d}`}><div className="mb-1 flex justify-between text-sm"><span className="capitalize text-slate-600">{d}</span><b className="text-ink">{v ?? '—'}</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand transition-[width] duration-700" style={{ width: `${v || 0}%` }} /></div></div>
          ); })}</div>
        </Panel>
        <Panel title="Verification checklist" testId="verification-checklist">
          <ul className="space-y-3 p-5">{checks.map(([l, ok]) => <li key={l} className="flex items-center gap-3 text-sm">{ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-300" />}<span className={ok ? 'text-ink' : 'text-slate-500'}>{l}</span></li>)}</ul>
          {!user.mobileVerified && <div className="px-5 pb-5"><Link to="/employee/settings" className="text-xs font-semibold text-brand">Verify mobile in settings →</Link></div>}
        </Panel>
      </div>
    </div>
  );
}
