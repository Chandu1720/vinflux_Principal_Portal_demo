import React from 'react';
import { GitBranch, Layers, MapPin, User } from 'lucide-react';
import type { GtmConfiguration, TermScope } from '../../types';
import { StatusBadge } from '../ui/Display';

/** Partner status badge using configured labels / tones (Status Configuration). */
export const PartnerStatusBadge: React.FC<{ status: string; config?: GtmConfiguration }> = ({ status, config }) => {
  const def = config?.partnerStatuses.find((s) => s.key === status);
  return <StatusBadge status={status} label={def?.label} tone={def?.tone} title={def?.description} />;
};

const ORIGIN: Record<TermScope, { bg: string; c: string; Icon: React.ElementType }> = {
  RELATIONSHIP: { bg: '#fdf2f8', c: '#be185d', Icon: GitBranch },
  PARTNER: { bg: '#f5f3ff', c: '#6d28d9', Icon: User },
  TERRITORY: { bg: '#ecfeff', c: '#0e7490', Icon: MapPin },
  CHANNEL: { bg: '#f1f5f9', c: '#475569', Icon: Layers },
};

/** Shows where a commercial value originated (precedence source). */
export const OriginBadge: React.FC<{ scope: TermScope; label: string }> = ({ scope, label }) => {
  const o = ORIGIN[scope];
  return <span className="g2-origin" style={{ background: o.bg, color: o.c }} title={label}><o.Icon size={11} />{label}</span>;
};
