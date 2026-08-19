import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An error occurred',
  message = 'Failed to load content from the server. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#3D2020]/40 border border-[#5E3232] rounded-xl p-5 flex flex-col items-center text-center max-w-lg mx-auto ${className}`}
    >
      <div className="p-2.5 bg-[#3D2020] rounded-full text-[#E89D9D] mb-2.5">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-[#E89D9D]">{title}</h4>
      <p className="text-xs text-[#E89D9D]/90 mt-1 mb-3.5 leading-relaxed">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
