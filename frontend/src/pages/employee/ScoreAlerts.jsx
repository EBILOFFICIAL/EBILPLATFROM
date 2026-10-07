import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from '../../components/common/Layout';
import { useFetch } from '../../hooks/usePagination';
import { employeeService } from '../../services/employeeService';
import { fmtDateTime } from '../../utils/formatters';

export function ScoreAlerts() {
  const { data } = useFetch(() => employeeService.notifications({ type: 'score' }), []);
  const rows = (data || []).slice(0, 5);
  return (
    <Panel title="Score change alerts" testId="score-alerts-panel" actions={<Link to="/employee/score" className="text-xs font-semibold text-brand" data-testid="score-alerts-history-link">Full history →</Link>}>
      {!rows.length ? <p className="p-5 text-sm text-slate-400" data-testid="score-alerts-empty">No score changes yet. You'll be alerted here, in the bell and by email when a verified event moves your score.</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((n) => {
            const { delta, oldScore, newScore, reason } = n.meta || {};
            const up = delta > 0;
            return (
              <li key={n._id || n.id} data-testid="score-alert-item" className="flex items-center gap-4 px-5 py-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-light text-brand'}`}>{up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{reason}</div><div className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</div></div>
                <div className="text-right"><div className={`font-mono text-sm font-bold ${up ? 'text-emerald-600' : 'text-brand'}`}>{up ? '+' : ''}{delta}</div><div className="font-mono text-xs text-slate-500">{oldScore} → {newScore}</div></div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export default ScoreAlerts;
