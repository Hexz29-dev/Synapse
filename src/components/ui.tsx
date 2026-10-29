import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { Icon } from './icons';

export const spring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 28 } as const;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
export function Logo({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? '#fafafa' : 'var(--color-ink)';
  const fg = inverted ? '#161616' : 'var(--color-surface)';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={bg} />
      <path d="M10 21.5 16 10.5l6 11" fill="none" stroke={fg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
      <circle cx="10" cy="21.5" r="2.6" fill={fg} />
      <circle cx="16" cy="10.5" r="2.6" fill={fg} />
      <circle cx="22" cy="21.5" r="2.6" fill={fg} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:opacity-90 disabled:opacity-50',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken',
  ghost: 'text-muted hover:text-ink hover:bg-ink/[0.06]',
  danger: 'bg-[#b42318] text-white hover:bg-[#9a1f15]',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 sm:h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 sm:h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, children, className, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring}
      className={cx(
        'relative inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...rest}
    >
      <span className={cx('inline-flex items-center gap-[inherit]', loading && 'opacity-0')}>
        {icon}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </motion.button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...rest
}: { label: string; children: ReactNode } & Omit<HTMLMotionProps<'button'>, 'children'>) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className={cx(
        'inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink',
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <motion.span
      aria-label="Carregando"
      className={cx('block h-4 w-4 rounded-full border-2 border-current border-r-transparent', className)}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Campos de formulário (text-base no mobile evita zoom automático no iOS)
// ---------------------------------------------------------------------------
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon, trailing, hint, className, id, ...rest },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint transition-colors group-focus-within:text-ink">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={cx(
            'h-11 w-full rounded-[10px] border border-line bg-surface text-base sm:text-[15px] text-ink placeholder:text-faint',
            'transition-[border-color,box-shadow] outline-none hover:border-line-strong',
            'focus:border-ink focus:shadow-[0_0_0_4px_rgb(22_22_22/0.06)]',
            icon ? 'pl-10' : 'pl-3.5',
            trailing ? 'pr-11' : 'pr-3.5'
          )}
          {...rest}
        />
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextArea({ label, hint, className, id, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={cx(
          'scrollbar-thin w-full resize-y rounded-[10px] border border-line bg-surface px-3.5 py-3 font-mono text-base sm:text-[13px] leading-relaxed text-ink placeholder:text-faint',
          'outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-ink focus:shadow-[0_0_0_4px_rgb(22_22_22/0.06)]'
        )}
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal (Bottom-sheet no mobile, Dialog central no desktop)
// ---------------------------------------------------------------------------
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, description, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx(
              'scrollbar-thin relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-pop sm:rounded-2xl',
              width
            )}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={softSpring}
          >
            {/* Puxador visual de bottom-sheet no mobile */}
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-line-strong" />
            </div>

            <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:px-6 sm:pt-6">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <IconButton label="Fechar" onClick={onClose} className="-mr-1.5 -mt-1">
                <Icon.Add className="rotate-45" />
              </IconButton>
            </div>
            <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} width="max-w-sm">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button
          variant="danger"
          loading={busy}
          className="w-full sm:w-auto"
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toasts (posicionados acima da barra inferior no mobile)
// ---------------------------------------------------------------------------
type Toast = { id: number; kind: 'success' | 'error'; message: string };
const ToastContext = createContext<(kind: Toast['kind'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 2800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-5">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={spring}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-pop ring-1 ring-line"
            >
              {t.kind === 'success' ? (
                <Icon.Success size={18} className="shrink-0 text-surface/75" />
              ) : (
                <Icon.Danger size={18} className="shrink-0 text-[#fca5a5]" />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-sunken px-1 font-mono text-[11px] font-medium text-muted shadow-[0_1px_0_var(--color-line)]',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function PlainButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}
