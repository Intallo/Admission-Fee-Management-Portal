import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, required, id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(7);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-school-text mb-1">
            {label} {required && <span className="text-school-danger">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full px-3 py-2 text-sm bg-school-surface border rounded-md text-school-text placeholder-school-text-muted focus:outline-none focus:ring-2 focus:ring-school-focus focus:border-transparent transition-colors ${
            error ? 'border-school-danger' : 'border-school-border'
          } ${className}`}
          {...props}
        />
        {hint && !error && <p className="mt-1 text-xs text-school-text-muted">{hint}</p>}
        {error && <p className="mt-1 text-xs text-school-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
