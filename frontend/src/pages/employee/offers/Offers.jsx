import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, Panel } from '../../../components/common/Layout';
import Table from '../../../components/common/Table';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import FormModal from '../../../components/common/FormModal';
import { DevOtp } from '../../auth/Login';
import { useFetch } from '../../../hooks/usePagination';
import { employeeService } from '../../../services/employeeService';
import { fmtDate, fmtInr, run } from '../../../utils/formatters';

export default function Offers() {
  const { data, loading, reload } = useFetch(() => employeeService.offers(), []);
  const [declare, setDeclare] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [dispute, setDispute] = useState(null);
  const startAccept = async (o) => { const r = await run(employeeService.offerOtp(o._id)); setAccepting({ id: o._id, devOtp: r.data?.devOtp }); };
  return (<div>
    <PageHeader title="Offer letters" subtitle="Accepted offers are visible to employers holding your consent. Your current employer is not notified unless you allow it. CTC stays private to you." actions={<Button onClick={() => setDeclare(true)} data-testid="declare-offer"><Plus className="h-4 w-4" />Self-declare offer</Button>} />
    <Panel><Table loading={loading} rows={data} testId="offers-table" columns={[
      { title: 'Company', render: (r) => <b>{r.employerId?.companyName || r.companyName}</b> }, { title: 'Designation', key: 'designation' },
      { title: 'Joining', render: (r) => fmtDate(r.expectedJoiningDate) }, { title: 'Valid until', render: (r) => fmtDate(r.validUntil) },
      { title: 'Source', render: (r) => r.verified ? <StatusBadge status="verified" /> : <StatusBadge status="pending" tone="amber">Unverified</StatusBadge> },
      { title: 'My CTC (private)', render: (r) => fmtInr(r.ctcPrivate) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'issued' && r.source === 'employer' && <><Button size="sm" onClick={() => startAccept(r)} data-testid={`accept-offer-${r._id}`}>E-accept</Button><Button size="sm" variant="secondary" onClick={() => run(employeeService.declineOffer(r._id)).then(reload)} data-testid={`decline-offer-${r._id}`}>Decline</Button></>}
        {r.status === 'no_show' && <Button size="sm" variant="secondary" onClick={() => setDispute(r._id)} data-testid={`dispute-offer-${r._id}`}>Dispute no-show</Button>}
      </div>) },
    ]} /></Panel>
    <FormModal open={Boolean(accepting)} onClose={() => setAccepting(null)} title="E-accept offer with OTP" testId="accept-offer-modal" submitLabel="Accept offer" fields={[{ name: 'code', label: 'Code sent to your email', required: true }]} onSubmit={(f) => run(employeeService.acceptOffer(accepting.id, f.code)).then(reload)}><DevOtp code={accepting?.devOtp} /></FormModal>
    <FormModal open={Boolean(dispute)} onClose={() => setDispute(null)} title="Dispute no-show" testId="dispute-noshow-modal" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} onSubmit={(f) => run(employeeService.disputeOffer(dispute, f.reason)).then(reload)} />
    <FormModal open={declare} onClose={() => setDeclare(false)} title="Self-declare an offer" testId="declare-offer-modal" fields={[
      { name: 'companyName', label: 'Company', required: true }, { name: 'designation', label: 'Designation', required: true }, { name: 'location', label: 'Location' },
      { name: 'expectedJoiningDate', label: 'Expected joining', type: 'date' }, { name: 'validUntil', label: 'Valid until', type: 'date' }, { name: 'ctc', label: 'CTC (optional, private to you)', type: 'number' }, { name: 'accepted', label: 'I have already accepted this offer', type: 'checkbox', full: true },
    ]} onSubmit={(f) => run(employeeService.declareOffer(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null)))).then(reload)} />
  </div>);
}
