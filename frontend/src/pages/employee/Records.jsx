import { useState } from 'react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import { useFetch } from '../../hooks/usePagination';
import { employeeService } from '../../services/employeeService';
import { fmtDate, fmtDateTime, run } from '../../utils/formatters';

export function DisputeButton({ targetType, targetId, onDone }) {
  const [open, setOpen] = useState(false);
  return (<>
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid={`dispute-${targetType}-${targetId}`}>Dispute</Button>
    <FormModal open={open} onClose={() => setOpen(false)} title="Raise a dispute" testId="dispute-modal" submitLabel="Submit dispute" fields={[{ name: 'reason', label: 'What is incorrect and why? (min 10 chars)', type: 'textarea', required: true }]} onSubmit={async (f) => { await run(employeeService.raiseDispute({ targetType, targetId, reason: f.reason })); onDone?.(); }} />
  </>);
}

export function ScoreHistory() {
  const { data, loading } = useFetch(() => employeeService.scoreHistory(), []);
  return (<div><PageHeader title="Score history" subtitle="Every change to your score, with a plain-language reason. Each entry is sealed in the ledger." />
    <Panel><Table loading={loading} rows={[...(data || [])].reverse()} testId="score-history-table" columns={[
      { title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Reason', key: 'reason' },
      { title: 'Change', render: (r) => <b className={r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-brand' : 'text-slate-500'}>{r.source === 'baseline' ? 'Baseline' : `${r.delta > 0 ? '+' : ''}${r.delta}`}</b> },
      { title: 'Score', render: (r) => <span className="font-mono">{r.oldScore ?? '—'} → <b>{r.newScore}</b></span> }, { title: 'Ledger #', render: (r) => <span className="font-mono text-xs">{r.ledgerSeq}</span> },
      { title: '', render: (r) => r.source !== 'baseline' && <DisputeButton targetType="score_event" targetId={r._id} /> },
    ]} /></Panel></div>);
}

export function Evaluations() {
  const { data, loading, reload } = useFetch(() => employeeService.evaluations(), []);
  return (<div><PageHeader title="Evaluations received" subtitle="Quarterly ratings from your employers. Disputed evaluations are held out of your score until resolved." />
    <Panel><Table loading={loading} rows={data} testId="evaluations-table" columns={[
      { title: 'Employer', render: (r) => r.employerId?.companyName }, { title: 'Period', key: 'period' },
      { title: 'Perf / Prof / Rel / Cond', render: (r) => <span className="font-mono">{r.performance} / {r.professionalism} / {r.reliability} / {r.conduct}</span> },
      { title: 'Composite', key: 'composite' }, { title: 'Score impact', render: (r) => r.appliedDelta ? `${r.appliedDelta > 0 ? '+' : ''}${r.appliedDelta}` : '—' },
      { title: 'Comments', key: 'comments' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => ['accepted', 'held', 'submitted'].includes(r.status) && <DisputeButton targetType="evaluation" targetId={r._id} onDone={reload} /> },
    ]} /></Panel></div>);
}

export function Disputes() {
  const { data, loading } = useFetch(() => employeeService.disputes(), []);
  return (<div><PageHeader title="My disputes" subtitle="Every dispute receives a written outcome. SLA: 15 days." />
    <Panel><Table loading={loading} rows={data} testId="disputes-table" columns={[
      { title: 'Raised', render: (r) => fmtDate(r.createdAt) }, { title: 'Record', render: (r) => <StatusBadge status={r.targetType} tone="slate" /> },
      { title: 'Reason', key: 'reason' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Outcome', render: (r) => r.resolution || '—' }, { title: 'SLA due', render: (r) => fmtDate(r.slaDueAt) },
    ]} /></Panel></div>);
}
