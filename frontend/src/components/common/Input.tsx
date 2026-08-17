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
          <label htmlFor={inputId} className="text-xs font-semibold text-[#29352D] tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-[#617066] pointer-events-none">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-[#FAFCF9] border text-[#29352D] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 placeholder-[#8C9B90] focus:outline-none focus:ring-2 ${
              error
                ? 'border-[#F4D6D6] focus:ring-[#E8B4B4]'
                : 'border-[#C8D7C7] hover:border-[#7C9A82] focus:border-[#7C9A82] focus:ring-[#7C9A82]/30'
            } ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-[#617066]">{rightIcon}</div>}
        </div>
        {error && <span className="text-xs text-[#5C1D1D] font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-[#617066] leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
