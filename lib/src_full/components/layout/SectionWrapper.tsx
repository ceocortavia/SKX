import { ReactNode } from 'react';

interface SectionWrapperProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

export default function SectionWrapper({ 
  children, 
  className = "", 
  containerClassName = "" 
}: SectionWrapperProps) {
  return (
    <section className={`py-16 md:py-24 px-4 md:px-8 ${className}`}>
      <div className={`max-w-7xl mx-auto ${containerClassName}`}>
        {children}
      </div>
    </section>
  );
}