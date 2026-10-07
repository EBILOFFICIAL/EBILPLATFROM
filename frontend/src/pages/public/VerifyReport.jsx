import { useParams } from 'react-router-dom';
import { BadgeCheck, XCircle } from 'lucide-react';
import { useFetch } from '../../hooks/usePagination';
import { publicService } from '../../services/jobService';
import { fmtDateTime } from '../../utils/formatters';

export default function VerifyReport() {
  const { token } = useParams();
  const { data, error, loading } = useFetch(() => publicService.verifyReport(token), [token]);
  return (
    <div className="mx-auto max-w-lg px-5 py-20">
      <div data-testid="verify-report-card" className="card p-8 text-center">
        {loading ? 'Verifying…' : error ? (<><XCircle className="mx-auto h-12 w-12 text-brand" /><h1 className="mt-4 text-2xl font-bold text-ink">Report not authentic</h1><p className="mt-2 text-slate-500">{error}</p></>) : (
          <>
            <BadgeCheck className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-bold text-ink">Authentic EIBIL report</h1>
            <p className="mt-1 text-sm text-slate-500">{data.fullName} · {data.eibilId} · PAN {data.panMasked}</p>
            <div className="mt-6 font-display text-5xl font-extrabold text-ink">{data.score}</div>
            <div className="text-sm font-semibold text-slate-600">{data.band}</div>
            <p className="mt-6 text-xs text-slate-400">Score as of {fmtDateTime(data.asOf)} · generated {fmtDateTime(data.generatedAt)} · ledger integrity {data.ledgerValid ? 'verified' : 'BROKEN'}</p>
          </>
        )}
      </div>
    </div>
  );
}
