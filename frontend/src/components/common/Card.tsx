import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', id, onClick }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-[#F0F4EC] border border-[#C8D7C7] rounded-2xl shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-[#7C9A82] hover:bg-[#F5F8F2] hover:shadow-md' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`border-b border-[#C8D7C7]/70 pb-4 mb-4 ${className}`}>{children}</div>;

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <h3 className={`text-base sm:text-lg font-bold text-[#29352D] tracking-tight ${className}`}>{children}</h3>;

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <p className={`text-xs text-[#617066] mt-1 leading-relaxed ${className}`}>{children}</p>;

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`border-t border-[#C8D7C7]/70 pt-4 mt-4 flex items-center justify-between ${className}`}>{children}</div>;
