import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  percentageChange?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  percentageChange,
  trend = 'up',
  subtitle,
  icon,
  iconBg = '#F3E8FF', // Soft purple
  iconColor = '#7C3AED' // Enterprise purple
}) => {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {title}
          </span>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {value}
          </div>
        </div>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            backgroundColor: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
        {percentageChange && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontWeight: 600,
              color: trend === 'up' ? '#047857' : trend === 'down' ? '#B91C1C' : '#64748B',
              backgroundColor: trend === 'up' ? '#ECFDF5' : trend === 'down' ? '#FEF2F2' : '#F1F5F9',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {trend === 'up' && <ArrowUpRight size={14} />}
            {trend === 'down' && <ArrowDownRight size={14} />}
            {trend === 'neutral' && <Minus size={14} />}
            <span>{percentageChange}</span>
          </span>
        )}
        <span style={{ color: '#64748B' }}>{subtitle || 'vs previous month'}</span>
      </div>
    </div>
  );
};
