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
    success: 'bg-[#1B3B2B] text-[#7ECB98] border-[#2D5E44]',
    warning: 'bg-[#3B301D] text-[#E3BA7E] border-[#5E4D2E]',
    error: 'bg-[#3D2020] text-[#E89D9D] border-[#5E3232]',
    danger: 'bg-[#3D2020] text-[#E89D9D] border-[#5E3232]',
    info: 'bg-[#1B2F3D] text-[#86C5DA] border-[#2B4B61]',
    neutral: 'bg-[#1C261F] text-[#A3B5A7] border-[#2D3D32]',
    indigo: 'bg-[#2B253D] text-[#B3A7CF] border-[#443A61]',
    purple: 'bg-[#2B253D] text-[#B3A7CF] border-[#443A61]',
    primary: 'bg-[#223328] text-[#8EA895] border-[#344F3C]',
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
