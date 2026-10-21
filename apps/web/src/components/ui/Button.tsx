import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline';
  fullWidth?: boolean;
};

export default function Button({ children, variant = 'primary', fullWidth = false, className = '', ...props }: ButtonProps) {
  let base = "inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  let styles = "";
  switch (variant) {
    case 'primary':
      styles = "bg-forest text-sand hover:opacity-90";
      break;
    case 'secondary':
      styles = "bg-sand text-forest hover:bg-white";
      break;
    case 'accent':
      styles = "bg-gold text-forest hover:opacity-90";
      break;
    case 'danger':
      styles = "bg-terracotta text-white hover:opacity-90";
      break;
    case 'outline':
      styles = "border border-forest/20 text-forest hover:bg-forest/5";
      break;
  }

  return (
    <button 
      className={`${base} ${styles} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
