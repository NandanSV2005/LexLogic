import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9A82] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8F0E6] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantStyles = {
    primary:
      'bg-[#7C9A82] hover:bg-[#6B8870] text-white shadow-sm border border-[#6B8870]',
    secondary:
      'bg-[#DDE8DC] hover:bg-[#D2E2D0] text-[#29352D] border border-[#C8D7C7]',
    outline:
      'border border-[#7C9A82] hover:bg-[#DDE8DC] text-[#29352D]',
    danger:
      'bg-[#F4D6D6] hover:bg-[#ECC3C3] text-[#5C1D1D] border border-[#E8B4B4]',
    ghost:
      'text-[#29352D] hover:bg-[#DDE8DC] border border-transparent',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-xs sm:text-sm gap-2',
    lg: 'px-6 py-3 text-sm sm:text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
          <span>Processing...</span>
        </span>
      ) : (
        <>
          {leftIcon}
          <span>{children}</span>
          {rightIcon}
        </>
      )}
    </button>
  );
};
