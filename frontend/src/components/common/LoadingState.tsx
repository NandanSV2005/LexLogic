import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading details...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Loader2 className="w-7 h-7 text-[#7C9A82] animate-spin mb-3" />
      <span className="text-xs font-semibold text-[#617066] tracking-wide">{message}</span>
    </div>
  );
};
