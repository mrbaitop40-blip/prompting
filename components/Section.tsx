
import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children, actions }) => {
  return (
    <div className="bg-surface rounded-lg p-6 mb-6 shadow-lg">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-color">
        <h2 className="text-xl font-bold text-secondary">{title}</h2>
        {actions}
      </div>
      <div>{children}</div>
    </div>
  );
};
