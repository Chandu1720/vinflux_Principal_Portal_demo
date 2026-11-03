import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.trim().toLowerCase();

  let bg = '#F1F5F9';
  let text = '#475569';
  let border = '#E2E8F0';

  if (
    normalized === 'active' ||
    normalized === 'approved' ||
    normalized === 'verified' ||
    normalized === 'standard'
  ) {
    bg = '#ECFDF5';
    text = '#047857';
    border = '#A7F3D0';
  } else if (
    normalized === 'approval pending' ||
    normalized === 'pending review' ||
    normalized === 'pending' ||
    normalized === 'kyc pending'
  ) {
    bg = '#FFFBEB';
    text = '#B45309';
    border = '#FDE68A';
  } else if (normalized === 'kyc under review' || normalized === 'under review') {
    bg = '#EFF6FF';
    text = '#1D4ED8';
    border = '#BFDBFE';
  } else if (
    normalized === 'rejected' ||
    normalized === 'suspended' ||
    normalized === 'inactive'
  ) {
    bg = '#FEF2F2';
    text = '#B91C1C';
    border = '#FECACA';
  } else if (normalized === 'draft') {
    bg = '#F8FAFC';
    text = '#64748B';
    border = '#CBD5E1';
  } else if (normalized.includes('approved relationship')) {
    bg = '#FAF5FF';
    text = '#7E22CE';
    border = '#E9D5FF';
  } else if (normalized.includes('approved partner')) {
    bg = '#F5F3FF';
    text = '#6D28D9';
    border = '#DDD6FE';
  } else if (normalized.includes('territory-specific')) {
    bg = '#EFF6FF';
    text = '#2563EB';
    border = '#BFDBFE';
  }

  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: '9999px',
        padding,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: text
        }}
      />
      <span>{status}</span>
    </span>
  );
};
