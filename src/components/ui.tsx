import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("glass-card rounded-2xl p-6", className)} {...props}>
    {children}
  </div>
);


export const Button = ({ 
  children, 
  variant = 'primary', 
  className,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
}) => {

  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-premium transition-all',
    ghost: 'hover:bg-slate-100 text-slate-600 font-semibold py-2 px-4 rounded-premium transition-all',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-premium transition-all shadow-lg shadow-rose-500/20'
  };

  return (
    <button 
      className={cn(variants[variant], "inline-flex items-center justify-center gap-2", className)}
      {...props}
    >
      {children}
    </button>
  );
};

export const Badge = ({ 
  children, 
  variant = 'blue',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { 
  variant?: 'blue' | 'green' | 'red' | 'orange' | 'slate' | 'custom',
}) => {
  const styles = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    orange: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    custom: ''
  };
  return (
    <span 
      className={cn(
        "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider", 
        variant !== 'custom' && styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};


export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn("input-standard w-full", className)} {...props} />
);
