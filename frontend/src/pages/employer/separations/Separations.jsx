import { useState } from 'react';
import { PageHeader, Panel } from '../../../components/common/Layout';
import Table from '../../../components/common/Table';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import FormModal from '../../../components/common/FormModal';
import { useFetch } from '../../../hooks/usePagination';
import { employerService } from '../../../services/employerService';
import { authService } from '../../../services/authService';
import { fmtDate, label, run } from '../../../utils/formatters';
import { SEPARATION_TYPES } from '../../../constants';

const FIELDS = [
  { name: 'separationType', label: 'Separation type', type: 'select', options: SEPARATION_TYPES }, { name: 'noticeRequiredDays', label: 'Contractual notice (days)', type: 'number' }, { name: 'noticeServedDays', label: 'Notice served (days)', type: 'number' },
  { name: 'buyoutStatus', label: 'Buyout / release', type: 'select', options: ['none', 'paid', 'waived', 'early_release', 'garden_leave'] }, { name: 'handoverStatus', label: 'Handover', type: 'select', options: ['yes', 'partial', 'no'] },
  { name: 'rehireEligibility', label: 'Eligible for rehire', type: 'select', options: ['yes', 'no', 'conditional'] }, { name: 'settlementStatus', label: 'F&F settlement', type: 'select', options: ['pending', 'completed', 'on_hold'] },
  { name: 'assetsReturned', label: 'Assets returned', type: 'checkbox' }, { name: 'exitInterviewDone', label: 'Exit interview done', type: 'checkbox' },
  { name: 'comment', label: 'Short factual comment (moderated, 500 chars)', type: 'textarea', full: true },
];

export default function Separations() {
  const { data, loading, reload } = useFetch(() => employerService.separations(), []);
  const [edit, setEdit] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const save = async (f) => {
    const body = Object.fromEntries(Object.entries(f).filter(([k, v]) => FIELDS.some((x) => x.name === k) && v !== '' && v != null));
    await run(employerService.saveAssessment(edit._id, { ...body, disciplinaryEvidence: evidence }));
    reload();
  };
  const upload = async (e) => { const d = await run(authService.uploadDocument(e.target.files[0], 'disciplinary_evidence'), 'Evidence uploaded'); setEvidence([...evidence, { fileId: d.id, name: d.name }]); };
  return (<div><PageHeader title="Exits & notice-period assessments" subtitle="Submit within the deadline after the last working day. The employee gets a review window to accept, rebut or dispute before publishing. Misconduct/absconding need evidence and admin review." />
    <Panel><Table loading={loading} rows={data} testId="separations-table" columns={[
      { title: 'Employee', render: (r) => r.employeeId?.fullName }, { title: 'Type', render: (r) => label(r.separationType) }, { title: 'LWD', render: (r) => fmtDate(r.lastWorkingDay) },
      { title: 'Due', render: (r) => fmtDate(r.assessmentDueAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'Rebuttal', render: (r) => r.rebuttals?.[0]?.statement || '—' },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'awaiting_confirmation' && r.initiatedBy === 'employee' && <Button size="sm" onClick={() => run(employerService.confirmSeparation(r._id, { agree: true })).then(reload)} data-testid={`confirm-sep-${r._id}`}>Confirm dates</Button>}
        {['notice_running', 'assessment_pending'].includes(r.status) && <><Button size="sm" variant="secondary" onClick={() => { setEvidence(r.assessment?.disciplinaryEvidence || []); setEdit(r); }} data-testid={`assess-${r._id}`}>Assessment</Button>{r.assessment && <Button size="sm" onClick={() => run(employerService.submitAssessment(r._id)).then(reload)} data-testid={`submit-assess-${r._id}`}>Submit</Button>}</>}
      </div>) },
    ]} /></Panel>
    <FormModal open={Boolean(edit)} onClose={() => setEdit(null)} title="Exit assessment" testId="assessment-modal" fields={FIELDS} initial={{ separationType: edit?.separationType, assetsReturned: true, ...(edit?.assessment || {}) }} onSubmit={save}>
      <div><label className="label">Disciplinary evidence (required for misconduct/absconding)</label><input type="file" data-testid="evidence-upload" onChange={upload} className="text-sm" />{evidence.map((x) => <div key={x.fileId} className="text-xs text-slate-500">{x.name}</div>)}</div>
    </FormModal>
  </div>);
}
