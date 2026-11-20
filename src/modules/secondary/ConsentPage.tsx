/**
 * Consent & data sharing: per distributor on the VinFlux distributor platform, which kinds of this principal's data it
 * shares. Withdrawing a kind removes it from every screen at once (kept only in the audit trail). What is never shared
 * is locked by the platform. Every view of a distributor's data is logged, and the distributor sees the log too.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Link2, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, KpiCard, PageHeader, Switch } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import { claims as allClaims, subscribeClaims } from '../claims/claimsStore';
import { balances, subscribeStock } from '../inventory/stockStore';
import {
  NEVER_SHARED, SCOPE_HINT, SCOPE_LABEL, SCOPE_ORDER, SHARING_LABEL, accessLog, consentAllows, consentOf, logAccess, reports, requestConsent, setScope, setupOf, subscribeSecondary,
} from './secondaryStore';
import type { ConsentScopes, ConsentStatus } from './secondaryStore';

const TONE: Record<ConsentStatus, BadgeTone> = { 'Not requested': 'slate', Requested: 'amber', Granted: 'green', Declined: 'red', Withdrawn: 'red', Expired: 'red' };
const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const SHORT: Record<keyof ConsentScopes, string> = { catalogue: 'Catalogue', orders: 'Orders', sales: 'Sales', stock: 'Stock', claims: 'Claims', cases: 'Cases' };
const ALL: ConsentScopes = { catalogue: true, orders: true, sales: true, stock: true, claims: true, cases: false };

const ConsentPage: React.FC = () => {
  useSubscribe(subscribeSecondary, subscribeClaims, subscribeStock);
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const navigate = useNavigate();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const onPlat = partners.filter((p) => setupOf(p.id).onPlatform);
  const [sel, setSel] = useState<string>('');
  const cur = onPlat.find((p) => p.id === sel) ?? onPlat[0];
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  useEffect(() => { if (cur) logAccess(cur.id, 'Viewed consent and shared data summary', currentUser.name); }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unit = (id: string) => { const p = products.find((x) => x.id === id); return p?.pricingReference?.standardCost ?? (p?.pricingReference?.mrp ?? 0) * 0.6; };
  const seen = useMemo(() => {
    if (!cur) return null;
    const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const sales = reports(activePrincipal.id).filter((r) => r.partnerId === cur.id && r.status === 'Accepted').flatMap((r) => r.sales).filter((s) => s.date >= from);
    const stock = consentAllows(cur.id, 'stock') ? balances().filter((b) => b.warehouseId === cur.id && b.qty > 0 && b.locType !== 'TRANSIT') : [];
    const cl = consentAllows(cur.id, 'claims') ? allClaims(activePrincipal.id).filter((c) => c.partnerId === cur.id && !['Settled', 'Rejected'].includes(c.status)) : [];
    return { sell: sales.reduce((a, s) => a + s.value, 0), stock: stock.reduce((a, b) => a + b.qty * unit(b.productId), 0), claims: cl.length };
  }, [cur?.id, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = { full: onPlat.filter((p) => SCOPE_ORDER.filter((k) => k !== 'cases').every((k) => consentAllows(p.id, k))).length, partial: 0, none: 0 };
  counts.partial = onPlat.filter((p) => consentOf(p.id).status === 'Granted').length - counts.full;
  counts.none = onPlat.length - counts.full - counts.partial;
  const log = accessLog(onPlat.map((p) => p.id)).slice(0, 12);
  const pname = (id: string) => partners.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Consent & Data Sharing" description="Each link with a distributor on VinFlux shares only your products — catalogue, orders, secondary sales, stock and claims — and only what the distributor allows. Withdrawing a kind of data removes it from your screens at once."
        actions={<Button icon={<UserPlus size={15} />} onClick={() => navigate('/network')}>Invite a distributor</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Distributors on VinFlux" value={onPlat.length} icon={<Link2 size={22} />} color="#2563eb" bg="#eaf1ff" foot={`of ${partners.length} active partners`} />
        <KpiCard label="Sharing everything" value={counts.full} icon={<ShieldCheck size={22} />} color="#15803d" bg="#e7f7ee" foot="catalogue, orders, sales, stock, claims" />
        <KpiCard label="Sharing part" value={counts.partial} icon={<Eye size={22} />} color="#c77700" bg="#fff5e0" foot="some kinds withdrawn or not granted" />
        <KpiCard label="No data" value={counts.none} icon={<Lock size={22} />} color="#dc3545" bg="#fdecee" foot="not asked, waiting, declined or withdrawn" />
      </div>
      {onPlat.length === 0 ? (
        <Alert tone="info">No partner is marked as using the VinFlux distributor platform yet. Invite one, or mark a partner in Secondary Sales → partner setup.</Alert>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="cs-grid">
          <Card title="Linked distributors" subtitle="Click a row to see exactly what you receive from it" flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Distributor</th><th>Consent</th>{SCOPE_ORDER.map((k) => <th key={k} style={{ textAlign: 'center' }} title={SCOPE_LABEL[k]}>{SHORT[k]}</th>)}</tr></thead>
              <tbody>{onPlat.map((p) => {
                const c = consentOf(p.id);
                return (
                  <tr key={p.id} style={{ cursor: 'pointer', background: cur?.id === p.id ? '#f5f8ff' : undefined }} onClick={() => setSel(p.id)}>
                    <td><strong>{p.name}</strong><div className="g2-cell-sub">{SCOPE_ORDER.filter((k) => consentAllows(p.id, k)).length}/{SCOPE_ORDER.length} shared{c.validUntil ? ` · until ${c.validUntil}` : ''}</div></td>
                    <td><Badge tone={TONE[c.status]} dot>{c.status}</Badge></td>
                    {SCOPE_ORDER.map((k) => <td key={k} style={{ textAlign: 'center' }}>{consentAllows(p.id, k) ? <span style={{ color: '#15803d', fontWeight: 700 }}>✓</span> : <span className="g2-muted">—</span>}</td>)}
                  </tr>
                );
              })}</tbody>
            </table></div>
          </Card>
          {cur && (
            <div className="g2-stack" style={{ gap: 16 }}>
              <Card title={`Shared by ${cur.name}`} subtitle={`Customers: ${SHARING_LABEL[consentOf(cur.id).identity]}`}>
                {consentOf(cur.id).status === 'Not requested' || ['Declined', 'Withdrawn', 'Expired'].includes(consentOf(cur.id).status) ? (
                  <div className="g2-stack"><Alert tone="warn">Nothing is shared by {cur.name} right now ({consentOf(cur.id).status.toLowerCase()}).</Alert>
                    <div><Button variant="primary" size="sm" onClick={() => tell(requestConsent(cur.id, ALL, currentUser.name))}>Ask for consent</Button></div></div>
                ) : consentOf(cur.id).status === 'Requested' ? <Alert tone="info">Waiting for {cur.name} to answer in their VinFlux account. You can answer for them in Secondary Sales → partner setup (demo).</Alert> : (
                  <div className="g2-stack" style={{ gap: 10 }}>
                    <div className="g2-small g2-muted">Demo — the switches are the distributor’s. In the live platform only {cur.name} can change them.</div>
                    {SCOPE_ORDER.map((k) => (
                      <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ flex: '0 0 auto', paddingTop: 2 }}><Switch checked={consentAllows(cur.id, k)} onChange={(v: boolean) => tell(setScope(cur.id, k, v, `${cur.name} (owner)`))} /></span>
                        <div><div style={{ fontWeight: 600, fontSize: 13 }}>{SCOPE_LABEL[k]}</div><div className="g2-small g2-muted">{SCOPE_HINT[k]}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {seen && (
                <Card title={`What you see of ${cur.name}`}>
                  <div className="g2-grid g2-grid-3">
                    <div><div className="g2-small g2-muted">Sell-out (30 days)</div><div style={{ fontWeight: 700 }}>{consentAllows(cur.id, 'sales') ? inr(seen.sell) : 'Not shared'}</div></div>
                    <div><div className="g2-small g2-muted">Stock</div><div style={{ fontWeight: 700 }}>{consentAllows(cur.id, 'stock') ? inr(seen.stock) : 'Not shared'}</div></div>
                    <div><div className="g2-small g2-muted">Open claims</div><div style={{ fontWeight: 700 }}>{consentAllows(cur.id, 'claims') ? seen.claims : 'Not shared'}</div></div>
                  </div>
                </Card>
              )}
              <Card title={<span className="g2-row" style={{ gap: 6 }}><Lock size={15} /> Never shared — locked by the platform</span>} subtitle="Enforced for every link, whatever the agreement says">
                <div className="g2-stack" style={{ gap: 6 }}>{NEVER_SHARED.map((x) => <div key={x} className="g2-row g2-small" style={{ gap: 8 }}><Lock size={12} className="g2-muted" /> {x}</div>)}</div>
              </Card>
            </div>
          )}
        </div>
      )}
      {onPlat.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title="Who looked at shared data" subtitle="The distributor sees this log in their VinFlux account" flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Distributor</th></tr></thead>
              <tbody>{log.length === 0 ? <tr><td colSpan={4} className="g2-muted">Nothing viewed yet.</td></tr> : log.map((a, i) => <tr key={i}><td className="g2-small">{a.at.slice(0, 16).replace('T', ' ')}</td><td>{a.who}</td><td className="g2-small">{a.what}</td><td>{pname(a.partnerId)}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </div>
      )}
      <style>{`@media (max-width: 1000px){ .cs-grid{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
};
export default ConsentPage;
