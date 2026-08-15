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
      className={`p-10 sm:p-12 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur-sm max-w-lg mx-auto ${className}`}
    >
      <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mb-4">
        {icon || <FolderOpen className="w-7 h-7" />}
      </div>

      <h3 className="text-base font-bold text-slate-100 tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-sm">{description}</p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
