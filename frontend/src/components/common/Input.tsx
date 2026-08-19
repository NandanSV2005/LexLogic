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
          <label htmlFor={inputId} className="text-xs font-semibold text-[#A3B5A7] tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-[#A3B5A7] pointer-events-none">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-[#1C261F] border text-[#E6EFE8] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 transition-all duration-200 placeholder-[#74887A] focus:outline-none focus:ring-2 ${
              error
                ? 'border-[#5E3232] focus:ring-[#E89D9D]'
                : 'border-[#2D3D32] hover:border-[#8EA895] focus:border-[#8EA895] focus:ring-[#8EA895]/30'
            } ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-[#A3B5A7]">{rightIcon}</div>}
        </div>
        {error && <span className="text-xs text-[#E89D9D] font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-[#A3B5A7] leading-relaxed">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
