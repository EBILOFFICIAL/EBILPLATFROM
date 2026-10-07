import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ScanLine, XCircle } from 'lucide-react';
import Button from '../../components/common/Button';
import { useFetch } from '../../hooks/usePagination';
import { publicService } from '../../services/jobService';
import { fmtDate, fmtDateTime } from '../../utils/formatters';

function CodeForm({ initial = '' }) {
  const [code, setCode] = useState(initial);
  const navigate = useNavigate();
  const submit = (e) => { e.preventDefault(); if (code.trim()) navigate(`/verify/${encodeURIComponent(code.trim().toUpperCase())}`); };
  return (
    <form onSubmit={submit} className="flex gap-2" data-testid="verify-code-form">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EIB-XXXX-XXXX" data-testid="verify-code-input" className="input flex-1 font-mono uppercase tracking-wider" />
      <Button type="submit" data-testid="verify-code-submit">Verify</Button>
    </form>
  );
}

function Result({ data }) {
  const dims = ['performance', 'professionalism', 'reliability', 'conduct'];
  return (
    <div data-testid="verify-result-authentic">
      <div className="text-center">
        <BadgeCheck className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-ink">Authentic EIBIL report</h1>
        <p className="mt-1 text-sm text-slate-500" data-testid="verify-identity">{data.fullName} · {data.eibilId} · PAN {data.panMasked}</p>
        <div className="mt-6 font-display text-5xl font-extrabold text-ink" data-testid="verify-score">{data.score}</div>
        <div className="text-sm font-semibold text-slate-600">{data.band}</div>
      </div>
      {data.dimensions && (
        <div className="mt-6 grid grid-cols-2 gap-3" data-testid="verify-dimensions">
          {dims.map((d) => <div key={d} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs capitalize text-slate-500">{d}</div><b className="text-ink">{data.dimensions[d] ?? '—'}</b></div>)}
        </div>
      )}
      {data.employment?.length > 0 && (
        <ul className="mt-6 divide-y divide-slate-100 text-left text-sm" data-testid="verify-employment">
          {data.employment.map((e, i) => <li key={i} className="flex justify-between gap-3 py-2"><span><b className="text-ink">{e.company}</b><span className="block text-xs text-slate-500">{e.designation}</span></span><span className="text-xs text-slate-500">{fmtDate(e.startDate)} – {e.isCurrent ? 'Present' : fmtDate(e.endDate)}</span></li>)}
        </ul>
      )}
      <p className="mt-6 text-center text-xs text-slate-400">Code <span className="font-mono">{data.code}</span> · score as of {fmtDateTime(data.asOf)} · generated {fmtDateTime(data.generatedAt)} · ledger integrity <span data-testid="verify-ledger-status">{data.ledgerValid ? 'verified' : 'BROKEN'}</span></p>
    </div>
  );
}

function Lookup({ token }) {
  const { data, error, loading } = useFetch(() => publicService.verifyReport(token), [token]);
  if (loading) return <p className="text-center text-slate-500">Verifying…</p>;
  if (error) return <div className="text-center" data-testid="verify-result-invalid"><XCircle className="mx-auto h-12 w-12 text-brand" /><h1 className="mt-4 text-2xl font-bold text-ink">Report not authentic</h1><p className="mt-2 text-slate-500">{error}</p></div>;
  return <Result data={data} />;
}

export default function VerifyReport() {
  const { token } = useParams();
  return (
    <div className="mx-auto max-w-lg px-5 py-20">
      <div data-testid="verify-report-card" className="card p-8">
        {token ? <Lookup token={token} /> : (
          <div className="mb-6 text-center"><ScanLine className="mx-auto h-10 w-10 text-brand" /><h1 className="mt-4 text-2xl font-bold text-ink">Verify an EIBIL report</h1><p className="mt-2 text-sm text-slate-500">Enter the verification code printed on the PDF, or scan its QR code.</p></div>
        )}
        <div className={token ? 'mt-8 border-t border-slate-100 pt-6' : ''}>{token && <p className="mb-2 text-xs font-semibold text-slate-500">Verify another report</p>}<CodeForm /></div>
      </div>
    </div>
  );
}
