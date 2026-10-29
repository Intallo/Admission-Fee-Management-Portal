import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold tracking-wide';

  const variantStyles = {
    default: 'bg-gray-100 text-school-text border border-school-border',
    success: 'bg-green-50 text-school-success border border-green-300',
    warning: 'bg-amber-50 text-school-warning border border-amber-300',
    danger: 'bg-red-50 text-school-danger border border-red-300',
    info: 'bg-blue-50 text-school-focus border border-blue-300',
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
