import { cloneElement, useEffect, useId, useRef } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Button({ children, variant = 'primary', className = '', loading, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button ${variant} ${className}`}
    >
      {loading && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs your attention</strong>
        <p>{error?.message || String(error || 'Please try again.')}</p>
        {retry && (
          <Button variant="ghost" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Loading({ label = 'Opening the case file…' }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function EmptyState({ title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Search size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({ label, error, hint, children }) {
  const id = useId();
  const attributes = {
    id: `${id}-input`,
    'aria-labelledby': `${id}-label`,
    'aria-invalid': Boolean(error),
    'aria-describedby': error || hint ? id : undefined,
  };
  return (
    <label className="field" htmlFor={attributes.id}>
      <span id={`${id}-label`} className="field-label">
        {label}
      </span>
      {typeof children === 'function' ? children(attributes) : cloneElement(children, attributes)}
      {(error || hint) && (
        <span id={id} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </span>
      )}
    </label>
  );
}
export function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Mystery Room home">
      <span className="brand-mark">
        <Search size={22} strokeWidth={1.7} />
      </span>
      <span>
        MYSTERY<span className="brand-light">ROOM</span>
        <small>THE TRUTH IS IN THE DETAILS</small>
      </span>
    </Link>
  );
}
export function BackLink({ to, children = 'Back to case files' }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowRight size={15} className="rotate" />
      {children}
    </Link>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null),
    closeRef = useRef(onClose),
    titleId = useId();
  closeRef.current = onClose;
  useEffect(() => {
    const old = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current;
    root?.focus();
    const handle = (e) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = [
          ...root.querySelectorAll(
            'button:not(:disabled), a, input, textarea, select, [tabindex="0"]',
          ),
        ];
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handle);
      old?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ConfirmDialog({
  title,
  children,
  confirm = 'Confirm',
  danger,
  onConfirm,
  onClose,
  loading,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p>{children}</p>
        <div className="button-row">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
