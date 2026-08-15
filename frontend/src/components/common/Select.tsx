import React, { forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-slate-950 border text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-500/80 focus:ring-rose-500/50'
              : 'border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100 py-1">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-rose-400 font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-400 leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
