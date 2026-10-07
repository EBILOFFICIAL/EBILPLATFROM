import { Link } from 'react-router-dom';
import { MapPin, Briefcase, ShieldCheck, Gauge } from 'lucide-react';
import { fmtInr, label } from '../../utils/formatters';

export default function JobCard({ job, to }) {
  return (
    <Link to={to} data-testid={`job-card-${job._id}`} className="card group block p-6 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{job.employerId?.companyName}</div>
          <h3 className="mt-1 text-lg font-bold text-ink group-hover:text-brand">{job.title}</h3>
        </div>
        {job.featured && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-bold text-brand">Featured</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location || 'India'}</span>
        <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{label(job.type)} · {job.experienceMin}+ yrs</span>
        <span className="flex items-center gap-1 font-semibold text-ink"><Gauge className="h-3.5 w-3.5 text-brand" />Min score {job.minEibilScore || 'Any'}</span>
        {job.employerTrustIndex != null && <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Employer trust {job.employerTrustIndex}</span>}
      </div>
      {(job.salaryMin || job.salaryMax) && <div className="mt-4 text-sm font-semibold text-slate-700">{fmtInr(job.salaryMin)} – {fmtInr(job.salaryMax)} / yr</div>}
    </Link>
  );
}
