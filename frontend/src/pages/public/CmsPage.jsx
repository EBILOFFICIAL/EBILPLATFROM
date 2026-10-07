import { useFetch } from '../../hooks/usePagination';
import { publicService } from '../../services/jobService';

export default function CmsPage({ slug, children }) {
  const { data: page, error } = useFetch(() => publicService.cms(slug), [slug]);
  const c = page?.content || {};
  return (
    <div className="mx-auto max-w-4xl px-5 py-20 lg:px-8">
      <div className="eyebrow">{page?.title}</div>
      <h1 data-testid="cms-heading" className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{c.heading || page?.title}</h1>
      {error && <p className="mt-6 text-slate-500">{error}</p>}
      <div data-testid="cms-body" className="mt-8 space-y-5 whitespace-pre-line text-lg leading-relaxed text-slate-600">{c.body}</div>
      {children}
    </div>
  );
}
