import React from 'react';
import { Switch } from '../../../components/ui';

/** Label + description + control row used by rule sections. */
export const RuleRow: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="g2-list-item" style={{ justifyContent: 'space-between' }}>
    <div style={{ minWidth: 0 }}>
      <div className="g2-strong">{title}</div>
      <div className="g2-cell-sub">{description}</div>
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

export const SwitchRule: React.FC<{ title: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({ title, description, checked, onChange }) => (
  <RuleRow title={title} description={description}><Switch checked={checked} onChange={onChange} label={title} /></RuleRow>
);
