import React from 'react';
import { MapPin } from 'lucide-react';
import type { Territory } from '../../types';

/** Shown when the signed-in user only sees part of the data (territory scope from Users & Roles). */
export const ScopeBanner: React.FC<{ scope: string[]; territories: Territory[]; hidden: number }> = ({ scope, territories, hidden }) => {
  if (!scope.length) return null;
  const names = scope.map((id) => territories.find((t) => t.id === id)?.name ?? id).join(', ');
  return (
    <div className="g2-alert g2-alert-info" style={{ marginBottom: 12 }}>
      <MapPin size={15} />
      <div>Showing your territories only: <strong>{names}</strong>{hidden > 0 ? ` · ${hidden} record(s) outside your scope are hidden` : ''}.</div>
    </div>
  );
};
