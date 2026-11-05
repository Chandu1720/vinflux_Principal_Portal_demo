import React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { BadgeTone } from '../../types';
import { Button } from './Button';

export const Badge: React.FC<{ tone?: BadgeTone; dot?: boolean; children: React.ReactNode; title?: string }> = ({ tone = 'slate', dot, children, title }) => (
  <span className={`g2-badge g2-tone-${tone}`} title={title}>{dot && <span className="dot" />}{children}</span>
);

const DEFAULT_TONES: Record<string, BadgeTone> = {
  Active: 'green', Inactive: 'slate', Draft: 'slate', Pending: 'amber', Approved: 'green', Rejected: 'red', Verified: 'green',
  'Under Review': 'blue', Suspended: 'red', 'KYC Pending': 'amber', 'KYC Under Review': 'blue', 'Approval Pending': 'purple',
  'Not Required': 'slate', Waiting: 'slate', Expired: 'slate', Scheduled: 'cyan',
};

/** Status badge — tone can be overridden by configured status definitions. */
export const StatusBadge: React.FC<{ status: string; tone?: BadgeTone; label?: string; title?: string }> = ({ status, tone, label, title }) => (
  <Badge tone={tone ?? DEFAULT_TONES[status] ?? 'slate'} dot title={title}>{label ?? status}</Badge>
);

export const Card: React.FC<{
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; flush?: boolean; className?: string; style?: React.CSSProperties;
}> = ({ title, subtitle, actions, children, flush, className = '', style }) => (
  <section className={`g2-card ${className}`} style={style}>
    {(title || actions) && (
      <div className="g2-card-head">
        <div style={{ minWidth: 0 }}>
          {title && <h3 className="g2-card-title">{title}</h3>}
          {subtitle && <div className="g2-card-sub">{subtitle}</div>}
        </div>
        {actions && <div className="g2-row">{actions}</div>}
      </div>
    )}
    <div className={`g2-card-body ${flush ? 'flush' : ''}`}>{children}</div>
  </section>
);

export const KpiCard: React.FC<{
  label: string; value: React.ReactNode; icon: React.ReactNode; color: string; bg: string; foot?: React.ReactNode; onClick?: () => void;
}> = ({ label, value, icon, color, bg, foot, onClick }) => (
  <div className={`g2-card g2-kpi ${onClick ? 'clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }}>
    <div className="g2-kpi-icon" style={{ background: bg, color }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div className="g2-kpi-label">{label}</div>
      <div className="g2-kpi-value">{value}</div>
      {foot && <div className="g2-kpi-foot">{foot}</div>}
    </div>
  </div>
);

export const PageHeader: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="g2-page-head">
    <div style={{ minWidth: 0 }}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="g2-page-actions">{actions}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode }> = ({ title, description, icon, action }) => (
  <div className="g2-empty">
    <div className="g2-empty-icon">{icon ?? <Inbox size={24} />}</div>
    <h4>{title}</h4>
    {description && <p>{description}</p>}
    {action}
  </div>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="g2-loading" role="status"><Loader2 size={18} className="g2-spin" /> {label}</div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="g2-empty">
    <div className="g2-empty-icon" style={{ background: 'var(--g2-red-bg)', color: 'var(--g2-red)' }}><AlertTriangle size={24} /></div>
    <h4>Something went wrong</h4>
    <p>{message}</p>
    {onRetry && <Button icon={<RefreshCw size={14} />} onClick={onRetry}>Retry</Button>}
  </div>
);

export const Tabs: React.FC<{ tabs: { id: string; label: string; count?: number; icon?: React.ReactNode }[]; active: string; onChange: (id: string) => void }> = ({ tabs, active, onChange }) => (
  <div className="g2-tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={active === t.id} type="button" className={`g2-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
        {t.icon}{t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Segmented: React.FC<{ options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }> = ({ options, value, onChange }) => (
  <div className="g2-seg">
    {options.map((o) => <button key={o.id} type="button" className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
  </div>
);

export const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="g2-hl">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
};

export const Progress: React.FC<{ value: number; color?: string }> = ({ value, color }) => (
  <div className="g2-progress"><span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>
);

export const Stepper: React.FC<{ steps: string[]; current: number; maxReached: number; onSelect: (i: number) => void }> = ({ steps, current, maxReached, onSelect }) => (
  <div className="g2-stepper">
    {steps.map((s, i) => (
      <React.Fragment key={s}>
        {i > 0 && <span className="g2-step-sep" />}
        <button type="button" className={`g2-step ${i === current ? 'active' : i < maxReached || i < current ? 'done' : ''}`} disabled={i > maxReached} onClick={() => onSelect(i)}>
          <span className="g2-step-num">{i + 1}</span>{s}
        </button>
      </React.Fragment>
    ))}
  </div>
);
