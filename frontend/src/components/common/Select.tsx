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
          <label htmlFor={selectId} className="text-xs font-semibold text-[#A3B5A7] tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-[#1C261F] border text-[#E6EFE8] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 ${
            error
              ? 'border-[#5E3232] focus:ring-[#E89D9D]'
              : 'border-[#2D3D32] hover:border-[#8EA895] focus:border-[#8EA895] focus:ring-[#8EA895]/30'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1C261F] text-[#E6EFE8] py-1">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[#E89D9D] font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-[#A3B5A7] leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
