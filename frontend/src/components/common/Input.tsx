import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-slate-400 pointer-events-none">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-slate-950 border text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 placeholder-slate-500 focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-500/80 focus:ring-rose-500/50'
                : 'border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'
            } ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-slate-400">{rightIcon}</div>}
        </div>
        {error && <span className="text-xs text-rose-400 font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-400 leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
