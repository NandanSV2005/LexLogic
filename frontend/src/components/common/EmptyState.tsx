import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`p-8 sm:p-10 bg-[#233027] border border-[#2D3D32] rounded-2xl flex flex-col items-center justify-center text-center max-w-lg mx-auto ${className}`}
    >
      <div className="p-3 bg-[#1C261F] border border-[#2D3D32] text-[#8EA895] rounded-2xl mb-3">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>

      <h3 className="text-base font-bold text-[#E6EFE8] tracking-tight">{title}</h3>
      <p className="text-xs text-[#A3B5A7] mt-1.5 leading-relaxed max-w-sm">{description}</p>

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
