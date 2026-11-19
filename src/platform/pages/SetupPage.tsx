import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Info } from 'lucide-react';
import { Alert, Badge, Button, Card, PageHeader, Segmented } from '../ui';
import { MODULES } from '../modules';
import type { ModuleId } from '../modules';
import { usePlatform } from '../PlatformContext';
import { setOptions } from '../moduleOptions';
import type { OptionValue } from '../moduleOptions';
import { loadJson, saveJson } from '../store';
import { useApp } from '../../context/AppContext.tsx';
import { setDefaultSource } from '../../modules/inventory/stockSource';
import { orderSettings, saveOrderSettings } from '../../modules/orders/orderSettings';
import type { ReservationPoint } from '../../modules/orders/orderSettings';

/**
 * Setup checklist: plain questions a principal answers once at onboarding.
 * The answers switch modules on/off (level 1) and set their main options (level 2) in one go.
 * Everything can be changed later in Modules.
 */
export interface SetupAnswers {
  stock: 'erp' | 'vinflux' | 'none';
  orders: 'yes' | 'no';
  delivery: 'vinflux' | 'simple';
  prices: 'yes' | 'no';
  cases: 'none' | 'partners' | 'direct' | 'both';
  consignment: 'yes' | 'no';
  returns: 'yes' | 'no';
  recall: 'yes' | 'no';
  invoicing: 'erp' | 'vinflux';
  reservation: ReservationPoint;
  credit: 'block' | 'warn' | 'off';
  supply: 'buy' | 'erp-production' | 'none';
  crm: 'yes' | 'no';
  secondary: 'yes' | 'no';
  claims: 'yes' | 'no';
}

const DEFAULTS: SetupAnswers = { stock: 'erp', orders: 'yes', delivery: 'vinflux', prices: 'yes', cases: 'partners', consignment: 'yes', returns: 'yes', recall: 'yes', invoicing: 'erp', reservation: 'confirmation', credit: 'block', supply: 'buy', crm: 'yes', secondary: 'yes', claims: 'yes' };
const KEY = 'vinflux.setup.v1';

type Q = { id: keyof SetupAnswers; q: string; help?: string; options: { id: string; label: string }[]; show?: (a: SetupAnswers, medical: boolean) => boolean };
const QUESTIONS: { group: string; items: Q[] }[] = [
  { group: 'Stock', items: [
    { id: 'stock', q: 'Where does your stock live?', help: 'ERP: VinFlux reads stock from your ERP (Zoho, SAP…) and never changes it. VinFlux: you keep stock here. Not tracked: orders only, no stock check.', options: [{ id: 'erp', label: 'In our ERP' }, { id: 'vinflux', label: 'In VinFlux' }, { id: 'none', label: 'Not tracked' }] },
    { id: 'supply', q: 'How do you get your products?', help: 'Manufacturing stays in your ERP. VinFlux only needs the finished stock.', options: [{ id: 'buy', label: 'We buy / import finished goods' }, { id: 'erp-production', label: 'We make them (ERP runs production)' }, { id: 'none', label: 'Not relevant' }] },
  ] },
  { group: 'Selling', items: [
    { id: 'crm', q: 'Will your sales team track leads and deals in VinFlux?', help: 'Sales CRM: leads, opportunities, follow-ups and a team dashboard.', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'secondary', q: 'Do you want to see what your partners hold and sell (secondary sales)?', help: 'Partners report stock and sales by Partner Lite, their own software, a file, or your field team — checked against what you delivered.', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'orders', q: 'Will partners’ orders come through VinFlux?', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'prices', q: 'Do you keep price lists or hospital rate contracts in VinFlux?', help: 'Orders need prices, so this stays on when orders are on.', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'claims', q: 'Do you pay partners schemes after the sale (per unit sold, targets, display)?', help: 'Schemes & Claims: claims checked against verified secondary sales before you pay.', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'reservation', q: 'When should stock be set aside for an order?', show: (a) => a.orders === 'yes', options: [{ id: 'submission', label: 'When received' }, { id: 'approval', label: 'When approved' }, { id: 'confirmation', label: 'When confirmed' }] },
    { id: 'credit', q: 'If a partner is over its credit limit…', show: (a) => a.orders === 'yes', options: [{ id: 'block', label: 'Block the order' }, { id: 'warn', label: 'Warn only' }, { id: 'off', label: 'No credit check' }] },
    { id: 'invoicing', q: 'Who issues the tax invoice?', show: (a) => a.orders === 'yes', options: [{ id: 'erp', label: 'Our ERP' }, { id: 'vinflux', label: 'VinFlux' }] },
    { id: 'delivery', q: 'How do you want to handle dispatch?', show: (a) => a.orders === 'yes', help: 'Full: shipments, trips, carriers, proof of delivery. Simple: mark shipped and delivered on the order.', options: [{ id: 'vinflux', label: 'Full logistics in VinFlux' }, { id: 'simple', label: 'Simple ship / deliver' }] },
  ] },
  { group: 'Hospitals and surgery', items: [
    { id: 'cases', q: 'Who runs surgery cases at hospitals?', show: (_a, medical) => medical, help: 'Partners: distributors run cases on their platform; you see usage and implants. Direct: your team runs cases. Both: per hospital.', options: [{ id: 'none', label: 'No cases' }, { id: 'partners', label: 'Our partners' }, { id: 'direct', label: 'We do (direct)' }, { id: 'both', label: 'Both' }] },
    { id: 'consignment', q: 'Do you or your partners keep consignment sets at hospitals?', show: (a, medical) => medical && a.cases !== 'none', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
  ] },
  { group: 'After sales', items: [
    { id: 'returns', q: 'Do partners return goods to you?', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
    { id: 'recall', q: 'Do you need complaints and recall?', help: 'Recommended for medical devices. Needs Returns.', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
  ] },
];

/** Answers → modules switched on and module options. */
export const plan = (a: SetupAnswers, medical: boolean) => {
  const on: ModuleId[] = ['go-to-market', 'users'];
  if (a.crm === 'yes') on.push('crm');
  if (a.secondary === 'yes') on.push('secondary');
  if (a.claims === 'yes') on.push('claims');
  if (a.stock !== 'none' || a.orders === 'yes') on.push('inventory');
  if (a.prices === 'yes' || a.orders === 'yes') on.push('price-lists');
  if (a.orders === 'yes') { on.push('orders'); if (a.delivery === 'vinflux') on.push('logistics'); }
  if (a.returns === 'yes' || a.recall === 'yes') on.push('returns');
  if (a.recall === 'yes') on.push('recall');
  const cases = medical && a.cases !== 'none';
  if (cases) on.push('surgical');
  const options: Record<string, OptionValue> = {
    'orders.invoicing': a.invoicing,
    'orders.creditCheck': a.credit,
    'returns.creditNotes': a.invoicing === 'vinflux',
    'surgical.cases': a.cases === 'direct' || a.cases === 'both',
    'surgical.caseRoles': a.cases === 'both' || a.cases === 'direct',
    'surgical.partnerUsage': a.cases === 'partners' || a.cases === 'both',
    'surgical.consignmentSets': a.consignment === 'yes',
    'recall.implantTrace': cases,
  };
  return { on, options };
};

const SetupPage: React.FC = () => {
  const { applyModules, enabled } = usePlatform();
  const { currentUser, activePrincipal, showToast, workspace } = useApp();
  const medical = workspace === 'medical-devices';
  const store = loadJson<Record<string, SetupAnswers>>(KEY, {});
  const [a, setA] = useState<SetupAnswers>({ ...DEFAULTS, ...(store[activePrincipal.id] ?? {}) });
  const [saved, setSaved] = useState(!!store[activePrincipal.id]);
  const canEdit = !!currentUser.permissions.canConfigurePlatform;
  const p = useMemo(() => plan(a, medical), [a, medical]);
  const set = (k: keyof SetupAnswers, v: string) => { setA({ ...a, [k]: v }); setSaved(false); };

  const apply = () => {
    const r = applyModules(p.on, currentUser.name);
    setOptions(p.options);
    setDefaultSource(a.stock === 'erp' ? 'ERP' : a.stock === 'vinflux' ? 'VINFLUX' : 'NONE');
    if (a.orders === 'yes') saveOrderSettings({ ...orderSettings(), reservation: a.reservation });
    saveJson(KEY, { ...store, [activePrincipal.id]: a });
    setSaved(true);
    showToast(r.message, r.ok ? 'success' : 'warning');
  };

  const available = MODULES.filter((m) => !m.core && m.status === 'available' && (!m.industries?.length || m.industries.includes(workspace)));
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Setup checklist" description={<>Answer once for <strong>{activePrincipal.name}</strong>. Only what you need is switched on; everything else stays hidden. You can change any answer later.</>}
        actions={<Button variant="primary" icon={<CheckCircle2 size={15} />} disabled={!canEdit} onClick={apply}>Apply setup</Button>} />
      {!canEdit && <Alert tone="warn">Only users with configuration rights can apply the setup.</Alert>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {QUESTIONS.map((g) => {
            const items = g.items.filter((q) => !q.show || q.show(a, medical));
            if (!items.length) return null;
            return (
              <Card key={g.group} title={g.group}>
                <div style={{ display: 'grid', gap: 18 }}>
                  {items.map((q) => (
                    <div key={q.id}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.q}</div>
                      <Segmented options={q.options} value={String(a[q.id])} onChange={(v) => set(q.id, v)} />
                      {q.help && <div className="g2-small g2-muted" style={{ marginTop: 6 }}>{q.help}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
        <Card title={<span className="g2-row"><ClipboardList size={16} /> What this switches on</span>} subtitle={saved ? 'Applied' : 'Not applied yet'} style={{ position: 'sticky', top: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {available.map((m) => {
              const will = p.on.includes(m.id) || MODULES.some((x) => p.on.includes(x.id) && x.dependsOn.includes(m.id));
              return (
                <div key={m.id} className="g2-row" style={{ justifyContent: 'space-between' }}>
                  <span>{m.name}</span>
                  <span className="g2-row" style={{ gap: 4 }}>
                    {will !== enabled(m.id) && <Badge tone="amber">changes</Badge>}
                    <Badge tone={will ? 'green' : 'slate'} dot>{will ? 'On' : 'Off'}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
          {a.supply === 'erp-production' && (
            <div className="g2-small" style={{ marginTop: 12, display: 'flex', gap: 6 }}><Info size={14} style={{ flexShrink: 0 }} /> Production stays in your ERP. Finished stock comes in through the stock connector.</div>
          )}
          {medical && a.cases === 'partners' && (
            <div className="g2-small" style={{ marginTop: 8, display: 'flex', gap: 6 }}><Info size={14} style={{ flexShrink: 0 }} /> Surgery Cases opens in read-only mode: implant register, sets and usage from partners’ cases.</div>
          )}
        </Card>
      </div>
    </div>
  );
};
export default SetupPage;
