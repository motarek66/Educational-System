import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, className, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx('app-button', `app-button--${variant}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle size={18} className="spinner-border spinner-border-sm" /> : null}
      {children}
    </button>
  );
});
