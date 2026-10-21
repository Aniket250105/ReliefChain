import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  variant?: 'low' | 'medium' | 'high' | 'critical' | 'default' | 'success' | 'warning' | 'neutral';
  className?: string;
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  let base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider";
  
  let styles = "";
  switch (variant) {
    case 'low':
      styles = "bg-forest/10 text-forest border border-forest/20";
      break;
    case 'medium':
      styles = "bg-gold/20 text-yellow-800 border border-gold/30";
      break;
    case 'high':
      styles = "bg-terracotta/10 text-terracotta border border-terracotta/20";
      break;
    case 'critical':
      styles = "bg-terracotta text-white border border-terracotta";
      break;
    case 'success':
      styles = "bg-forest/10 text-forest border border-forest/20";
      break;
    case 'warning':
      styles = "bg-gold/20 text-yellow-800 border border-gold/30";
      break;
    case 'neutral':
      styles = "bg-gray-100 text-gray-700 border border-gray-200";
      break;
    default:
      styles = "bg-white text-forest border border-forest/20";
  }

  return (
    <span className={`${base} ${styles} ${className}`}>
      {children}
    </span>
  );
}
