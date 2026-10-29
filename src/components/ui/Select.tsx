import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, hint, required, id, options, children, ...props }, ref) => {
    const selectId = id || props.name || Math.random().toString(36).substring(7);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-school-text mb-1">
            {label} {required && <span className="text-school-danger">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full px-3 py-2 text-sm bg-school-surface border rounded-md text-school-text focus:outline-none focus:ring-2 focus:ring-school-focus focus:border-transparent transition-colors ${
            error ? 'border-school-danger' : 'border-school-border'
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {hint && !error && <p className="mt-1 text-xs text-school-text-muted">{hint}</p>}
        {error && <p className="mt-1 text-xs text-school-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
