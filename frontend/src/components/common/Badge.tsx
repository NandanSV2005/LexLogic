import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'indigo'
  | 'purple'
  | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-[#D4E5D4] text-[#1F4724] border-[#B2D4B2]',
    warning: 'bg-[#F5E6CC] text-[#5C4114] border-[#E6CE9F]',
    error: 'bg-[#F4D6D6] text-[#5C1D1D] border-[#E8B4B4]',
    danger: 'bg-[#F4D6D6] text-[#5C1D1D] border-[#E8B4B4]',
    info: 'bg-[#D5E3F0] text-[#1C3B57] border-[#ADCDE6]',
    neutral: 'bg-[#E2E8E2] text-[#3A473E] border-[#C4D0C4]',
    indigo: 'bg-[#E6E2F0] text-[#3D3352] border-[#CBBFE0]',
    purple: 'bg-[#E6E2F0] text-[#3D3352] border-[#CBBFE0]',
    primary: 'bg-[#DCE7DB] text-[#29352D] border-[#B9CBB7]',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg border tracking-wide ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
