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
          <label htmlFor={selectId} className="text-xs font-semibold text-[#29352D] tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-[#FAFCF9] border text-[#29352D] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 ${
            error
              ? 'border-[#F4D6D6] focus:ring-[#E8B4B4]'
              : 'border-[#C8D7C7] hover:border-[#7C9A82] focus:border-[#7C9A82] focus:ring-[#7C9A82]/30'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#F0F4EC] text-[#29352D] py-1">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[#5C1D1D] font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-[#617066] leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
