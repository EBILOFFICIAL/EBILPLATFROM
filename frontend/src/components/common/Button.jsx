import { Loader2 } from 'lucide-react';

export default function Button({ variant = 'primary', size, loading, children, className = '', ...props }) {
  return (
    <button className={`btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
