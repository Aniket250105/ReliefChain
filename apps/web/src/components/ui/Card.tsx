import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
};

export default function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-forest/10 animate-fade-in-up ${noPadding ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  );
}
