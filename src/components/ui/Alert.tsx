import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'error';
  title?: string;
}

export function Alert({ className = '', variant = 'info', title, children, ...props }: AlertProps) {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div
      role="alert"
      className={`p-4 rounded-md border text-sm ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {title && <h5 className="font-semibold mb-1">{title}</h5>}
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}
