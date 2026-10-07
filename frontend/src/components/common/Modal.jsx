import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, wide, testId = 'modal' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div data-testid={testId} className={`card fade-up mt-12 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button data-testid={`${testId}-close`} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
