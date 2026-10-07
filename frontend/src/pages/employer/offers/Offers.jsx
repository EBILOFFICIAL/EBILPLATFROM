import { useState } from 'react';
import { PageHeader, Panel } from '../../../components/common/Layout';
import Table from '../../../components/common/Table';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import FormModal from '../../../components/common/FormModal';
import { useFetch } from '../../../hooks/usePagination';
import { employerService } from '../../../services/employerService';
import { fmtDate, run } from '../../../utils/formatters';

export default function EmployerOffers() {
  const { data, loading, reload } = useFetch(() => employerService.offers(), []);
  const [open, setOpen] = useState(false);
  const [withdraw, setWithdraw] = useState(null);
  const act = (fn, id) => run(fn(id)).then(reload);
  return (<div><PageHeader title="Offer letters" subtitle="Issue offers verified at source. Withdrawing an accepted offer lowers your Employer Trust Index." actions={<Button onClick={() => setOpen(true)} data-testid="issue-offer">Issue offer</Button>} />
    <Panel><Table loading={loading} rows={data} testId="employer-offers-table" columns={[
      { title: 'Candidate', render: (r) => `${r.employeeId?.fullName} (${r.employeeId?.eibilId})` }, { title: 'Designation', key: 'designation' }, { title: 'Joining', render: (r) => fmtDate(r.expectedJoiningDate) },
      { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'accepted' && <><Button size="sm" onClick={() => act(employerService.confirmJoin, r._id)} data-testid={`confirm-join-${r._id}`}>Confirm joined</Button><Button size="sm" variant="secondary" onClick={() => act(employerService.markNoShow, r._id)} data-testid={`no-show-${r._id}`}>No-show</Button></>}
        {['issued', 'accepted'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setWithdraw(r._id)} data-testid={`withdraw-${r._id}`}>Withdraw</Button>}
      </div>) },
    ]} /></Panel>
    <FormModal open={open} onClose={() => setOpen(false)} title="Issue offer" testId="issue-offer-modal" fields={[{ name: 'candidate', label: 'Candidate PAN / email / EIBIL ID', required: true }, { name: 'designation', label: 'Designation', required: true }, { name: 'department', label: 'Department' }, { name: 'location', label: 'Location' }, { name: 'validUntil', label: 'Valid until', type: 'date', required: true }, { name: 'expectedJoiningDate', label: 'Expected joining', type: 'date', required: true }]} onSubmit={(f) => run(employerService.issueOffer(f)).then(reload)} />
    <FormModal open={Boolean(withdraw)} onClose={() => setWithdraw(null)} title="Withdraw offer" testId="withdraw-offer-modal" fields={[{ name: 'reason', label: 'Reason (mandatory)', type: 'textarea', required: true }]} onSubmit={(f) => run(employerService.withdrawOffer(withdraw, f.reason)).then(reload)} />
  </div>);
}
