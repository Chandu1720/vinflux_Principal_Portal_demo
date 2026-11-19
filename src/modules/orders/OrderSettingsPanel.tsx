import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, MultiSelect, NumberInput, Segmented, Select, Switch, Textarea } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePlatform } from '../../platform/PlatformContext';
import { CONNECTORS, connectorSettings } from '../../platform/integrations/connectors';
import { setDefaultSource, setStockConnector, sourceSettings, subscribeSource } from '../inventory/stockSource';
import type { SourceSetting } from '../inventory/stockSource';
import { priceLists, subscribePricing } from '../pricing/pricingStore';
import { roles } from '../users/userStore';
import {
  CHANNELS, DEFAULT_EVENTS, EVENTS, INPUTS, RULE_TEXT, defaults, newRule, orderSettings, saveOrderSettings, subscribeOrderSettings,
} from './orderSettings';
import type { ApprovalRule, InputId, NotifyEvent, OrderSettings, RuleKind, SourceKind } from './orderSettings';
import type { OrderCtx } from './orderStore';
import { senderOf } from './notify';

const SOURCE_LABEL: Record<SourceKind, string> = { vinflux: 'VinFlux module', connected: 'Connected system', file: 'File / manual', none: 'Not used' };
const SOURCE_TONE: Record<SourceKind, 'blue' | 'purple' | 'amber' | 'slate'> = { vinflux: 'blue', connected: 'purple', file: 'amber', none: 'slate' };
const ago = (iso: string | null) => { if (!iso) return 'never'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

const SECTIONS = [
  { id: 'sources', label: 'Data sources' }, { id: 'inventory', label: 'Inventory' }, { id: 'intake', label: 'Order intake' },
  { id: 'approval', label: 'Approval rules' }, { id: 'confirm', label: 'Confirmation & part-fill' }, { id: 'changes', label: 'Changes' }, { id: 'notify', label: 'Notifications' },
];

export const OrderSettingsPanel: React.FC<{ ctx: OrderCtx; canConfigure: boolean }> = ({ ctx, canConfigure }) => {
  useSubscribe(subscribeOrderSettings, subscribeSource, subscribePricing);
  const { products, warehouses, showToast } = useApp();
  const { enabled } = usePlatform();
  const [sec, setSec] = useState('sources');
  const [ev, setEv] = useState<NotifyEvent>('confirmed');
  const s = orderSettings();
  const save = (next: OrderSettings, msg = 'Saved.') => { saveOrderSettings(next); showToast(msg, 'success'); };
  const set = <K extends keyof OrderSettings>(k: K, v: OrderSettings[K]) => save({ ...s, [k]: v });
  const st = sourceSettings();
  const erps = CONNECTORS.filter((c) => c.kind === 'ERP' && c.availability === 'sandbox');
  const stockConn = st.connectorId ? erps.find((c) => c.id === st.connectorId) : erps.find((c) => connectorSettings(c.id).enabled);
  const roleNames = roles().filter((r) => r.kind === 'Staff').map((r) => r.name);
  const dis = !canConfigure;

  /** What each input currently holds, and how fresh it is. */
  const health = (id: InputId, src: SourceKind): { ok: boolean; text: string } => {
    if (src === 'none') return { ok: true, text: INPUTS.find((i) => i.id === id)!.none };
    const conn = stockConn ? `${stockConn.name}, synced ${ago(connectorSettings(stockConn.id).lastSyncAt)}` : 'no ERP connector enabled';
    switch (id) {
      case 'products': return { ok: products.length > 0, text: `${products.length} products${src === 'connected' ? ' (from the ERP item import)' : ''}` };
      case 'partners': return { ok: ctx.partners.length > 0, text: `${ctx.partners.filter((p) => p.status === 'Active').length} active partners` };
      case 'policies': return { ok: ctx.flows.length > 0, text: `${ctx.flows.filter((f) => f.status === 'Active').length} active sales policies` };
      case 'prices': return { ok: priceLists().length > 0, text: src === 'connected' ? 'Read from the ERP price list' : `${priceLists().length} price lists / rate contracts` };
      case 'schemes': return { ok: true, text: src === 'connected' ? 'Read from the ERP' : 'Schemes in Price Lists' };
      case 'credit': return { ok: true, text: `${ctx.partners.filter((p) => p.credit).length} partners with credit figures` };
      case 'stock': return { ok: st.defaultSource === 'NONE' || !!stockConn || st.defaultSource === 'VINFLUX', text: st.defaultSource === 'VINFLUX' ? 'VinFlux Inventory' : st.defaultSource === 'NONE' ? 'Not tracked — manual confirmation' : conn };
      case 'warehouses': return { ok: warehouses.length > 0, text: `${warehouses.filter((w) => w.status === 'Active').length} warehouses` };
      case 'invoice': return { ok: true, text: src === 'connected' ? (stockConn ? `Read back from ${stockConn.name}` : 'Accounting system') : 'Typed in or register upload' };
      case 'tracking': return { ok: true, text: src === 'vinflux' ? (enabled('logistics') ? 'Logistics module' : 'Logistics module is switched off') : src === 'connected' ? 'Courier API (planned)' : 'Typed in at dispatch' };
      default: return { ok: true, text: '' };
    }
  };

  const rule = (r: ApprovalRule, i: number) => {
    const upd = (p: Partial<ApprovalRule>) => set('approval', { ...s.approval, rules: s.approval.rules.map((x) => (x.id === r.id ? { ...x, ...p } : x)) });
    const move = (d: number) => { const rs = [...s.approval.rules]; const j = i + d; if (j < 0 || j >= rs.length) return; [rs[i], rs[j]] = [rs[j], rs[i]]; set('approval', { ...s.approval, rules: rs }); };
    return (
      <div key={r.id} className="g2-card" style={{ padding: 12, marginBottom: 8, opacity: r.enabled ? 1 : 0.6 }}>
        <div className="g2-row" style={{ gap: 8, marginBottom: 8 }}>
          <span className="g2-small g2-muted" style={{ width: 18 }}>{i + 1}.</span>
          <div style={{ flex: 1 }}><Input value={r.name} disabled={dis} aria-label="Rule name" onChange={(e) => upd({ name: e.target.value })} /></div>
          <Switch checked={r.enabled} disabled={dis} label="On" onChange={(v) => upd({ enabled: v })} />
          <Button size="sm" variant="ghost" icon={<ArrowUp size={14} />} disabled={dis || i === 0} onClick={() => move(-1)} aria-label="Move up" />
          <Button size="sm" variant="ghost" icon={<ArrowDown size={14} />} disabled={dis || i === s.approval.rules.length - 1} onClick={() => move(1)} aria-label="Move down" />
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={dis} onClick={() => set('approval', { ...s.approval, rules: s.approval.rules.filter((x) => x.id !== r.id) })} aria-label="Delete rule" />
        </div>
        <FormGrid cols={3}>
          <Field label="When"><Select value={r.kind} disabled={dis} options={(Object.keys(RULE_TEXT) as RuleKind[]).map((k) => ({ value: k, label: RULE_TEXT[k] }))} onChange={(v) => upd({ kind: v as RuleKind })} /></Field>
          {r.kind === 'partnerType'
            ? <Field label="Partner types"><MultiSelect disabled={dis} values={r.partnerTypeIds} options={ctx.config.partnerTypes.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => upd({ partnerTypeIds: v })} /></Field>
            : r.kind === 'priceChange' ? <div /> : <Field label={r.kind === 'value' ? 'Above (₹)' : r.kind === 'discount' ? 'Above (%)' : 'First N orders'}><NumberInput value={r.threshold} disabled={dis} onChange={(v) => upd({ threshold: v ?? 0 })} /></Field>}
          <Field label="Approved by (in order)" hint="Two roles = two levels."><MultiSelect disabled={dis} values={r.levels} options={roleNames.map((n) => ({ value: n, label: n }))} onChange={(v) => upd({ levels: v })} /></Field>
        </FormGrid>
      </div>
    );
  };

  const e = s.notify.events[ev];
  const setEvent = (p: Partial<typeof e>) => set('notify', { ...s.notify, events: { ...s.notify.events, [ev]: { ...e, ...p } } });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: 16 }}>
      <nav className="g2-stack" style={{ gap: 2 }} aria-label="Order settings">
        {SECTIONS.map((x) => (
          <button key={x.id} type="button" onClick={() => setSec(x.id)} className="g2-small"
            style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: sec === x.id ? 'var(--g2-primary-50, #eef2ff)' : 'transparent', color: sec === x.id ? 'var(--g2-primary, #4338ca)' : undefined, fontWeight: sec === x.id ? 600 : 500 }}>{x.label}</button>
        ))}
        <div style={{ marginTop: 12 }}><Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} disabled={dis} onClick={() => save(defaults(), 'Order settings reset to the defaults.')}>Reset to defaults</Button></div>
      </nav>

      <div className="g2-stack">
        {dis && <Alert tone="info">Read-only — your role can’t change order settings.</Alert>}

        {sec === 'sources' && (
          <Card title="Data sources" subtitle="Order management runs on its own. Each input comes from a VinFlux module, your connected system, a file, or isn’t used — the order checks adapt (no credit source = no credit check).">
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Input</th><th>Source</th><th>Comes from</th><th>Now</th></tr></thead>
              <tbody>{INPUTS.map((inp) => {
                const src = s.sources[inp.id];
                const h = health(inp.id, src);
                return (
                  <tr key={inp.id}>
                    <td className="g2-strong">{inp.label}{inp.required && <div className="g2-cell-sub">Required</div>}</td>
                    <td style={{ minWidth: 190 }}>{inp.id === 'stock'
                      ? <Badge tone={SOURCE_TONE[src]} dot>{SOURCE_LABEL[src]}</Badge>
                      : <Select value={src} disabled={dis} aria-label={`${inp.label} source`} options={inp.options.map((o) => ({ value: o, label: SOURCE_LABEL[o] }))} onChange={(v) => set('sources', { ...s.sources, [inp.id]: v as SourceKind })} />}</td>
                    <td className="g2-small">{inp[src]}{inp.id === 'stock' && <div className="g2-cell-sub">Set under Inventory</div>}</td>
                    <td className="g2-small"><Badge tone={h.ok ? 'green' : 'amber'} dot>{h.ok ? 'OK' : 'Check'}</Badge> <span className="g2-muted">{h.text}</span></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </Card>
        )}

        {sec === 'inventory' && (
          <Card title="Inventory mode" subtitle="One mode for the whole principal: all stock comes from one source.">
            <div className="g2-stack">
              <Segmented value={st.defaultSource === 'AUTO' ? 'ERP' : st.defaultSource} onChange={(v) => {
                if (dis) return;
                setDefaultSource(v as SourceSetting);
                save({ ...s, sources: { ...s.sources, stock: v === 'VINFLUX' ? 'vinflux' : v === 'ERP' ? 'connected' : 'none' } }, 'Inventory mode saved.');
              }} options={[{ id: 'VINFLUX', label: 'A · Stock in VinFlux' }, { id: 'ERP', label: 'B · Stock in your ERP' }, { id: 'NONE', label: 'C · No stock sync' }]} />
              {(st.defaultSource === 'ERP' || st.defaultSource === 'AUTO') && (
                <FormGrid>
                  <Field label="Connector supplying all stock" hint="Its warehouse mapping (Integration Hub) decides which ERP location is which warehouse."><Select value={st.connectorId ?? ''} disabled={dis} placeholder="Any enabled connector" options={erps.map((c) => ({ value: c.id, label: `${c.name}${connectorSettings(c.id).enabled ? '' : ' (not enabled)'}` }))} onChange={(v) => { setStockConnector(v || null); showToast('Stock connector saved.', 'success'); }} /></Field>
                  <Field label="Stock figure at confirmation"><Select value={s.inventory.read} disabled={dis} options={[{ value: 'live-fallback', label: 'Read live, fall back to the last sync (recommended)' }, { value: 'live', label: 'Read live only — block if the ERP doesn’t answer' }, { value: 'sync', label: 'Last sync only' }]} onChange={(v) => set('inventory', { read: v as OrderSettings['inventory']['read'] })} /></Field>
                </FormGrid>
              )}
              <Alert tone="info">{st.defaultSource === 'VINFLUX' ? 'Goods receipts, QC, adjustments and stock movements are recorded in VinFlux Inventory. Available = sellable stock − reservations.'
                : st.defaultSource === 'NONE' ? 'No stock figure: the order desk confirms quantities by hand (or “confirm as ordered”). Batch / serial are typed at dispatch. Auto-confirm does not apply.'
                  : `Available = ERP stock − quantity VinFlux has reserved and the ERP hasn’t invoiced yet. ${stockConn ? `${stockConn.name}: last sync ${ago(connectorSettings(stockConn.id).lastSyncAt)}.` : 'Enable a connector in Integration Hub.'}`}</Alert>
            </div>
          </Card>
        )}

        {sec === 'intake' && (
          <Card title="Order intake channels" subtitle="Switch channels on or off for this principal; block a channel for individual partners (e.g. no portal access).">
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Channel</th><th>How</th><th>On</th><th>Blocked for</th></tr></thead>
              <tbody>{CHANNELS.map((c) => (
                <tr key={c.id}>
                  <td className="g2-strong">{c.label}</td><td className="g2-small g2-muted">{c.who}</td>
                  <td><Switch checked={s.channels[c.id]} disabled={dis} onChange={(v) => set('channels', { ...s.channels, [c.id]: v })} /></td>
                  <td style={{ minWidth: 220 }}><MultiSelect disabled={dis} values={Object.entries(s.partnerBlocks).filter(([, chs]) => chs.includes(c.id)).map(([p]) => p)}
                    options={ctx.partners.map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(ids) => {
                      const pb: Record<string, typeof c.id[]> = {};
                      new Set([...Object.keys(s.partnerBlocks), ...ids]).forEach((p) => { const cur = (s.partnerBlocks[p] ?? []).filter((x) => x !== c.id); pb[p] = ids.includes(p) ? [...cur, c.id] : cur; if (!pb[p].length) delete pb[p]; });
                      set('partnerBlocks', pb);
                    }} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
        )}

        {sec === 'approval' && (
          <Card title="Approval rules" subtitle="Checked from the top. No rule hits → the order goes straight on (auto-confirm). Credit hold and overdue are handled by Finance’s credit release (Go-to-Market → Configuration → Compliance)."
            actions={<Button size="sm" icon={<Plus size={14} />} disabled={dis} onClick={() => set('approval', { ...s.approval, rules: [...s.approval.rules, newRule()] })}>Add rule</Button>}>
            {s.approval.rules.length === 0 && <Alert tone="info">No rules — every order that passes the checks goes straight on.</Alert>}
            {s.approval.rules.map(rule)}
            <FormGrid>
              <Field label="Reminder after (hours)"><NumberInput value={s.approval.reminderHours} disabled={dis} onChange={(v) => set('approval', { ...s.approval, reminderHours: Math.max(1, v ?? 4) })} /></Field>
              <Field label="Escalate to the next level after (hours)" hint="The next approver (or an administrator) may then approve."><NumberInput value={s.approval.escalateHours} disabled={dis} onChange={(v) => set('approval', { ...s.approval, escalateHours: Math.max(1, v ?? 24) })} /></Field>
            </FormGrid>
          </Card>
        )}

        {sec === 'confirm' && (
          <Card title="Confirmation, reservation & part-fill">
            <div className="g2-stack">
              <Switch checked={s.autoConfirm} disabled={dis} label="Confirm automatically when everything is in stock and no rule hits" onChange={(v) => set('autoConfirm', v)} />
              <FormGrid>
                <Field label="Reserve stock on" hint="Reserved stock is taken out of what other orders can be promised."><Select value={s.reservation} disabled={dis} options={[{ value: 'submission', label: 'Submission (order received)' }, { value: 'approval', label: 'Approval (checks passed / approved)' }, { value: 'confirmation', label: 'Confirmation' }]} onChange={(v) => set('reservation', v as OrderSettings['reservation'])} /></Field>
                <Field label="When only part is in stock"><Select value={s.partFill.mode} disabled={dis} options={[{ value: 'partner', label: 'Ask the partner to choose (ship now / wait / accept proposed)' }, { value: 'desk', label: 'Order desk decides' }]} onChange={(v) => set('partFill', { ...s.partFill, mode: v as 'partner' | 'desk' })} /></Field>
                <Field label="Partner has to answer within (hours)"><NumberInput value={s.partFill.replyHours} disabled={dis} onChange={(v) => set('partFill', { ...s.partFill, replyHours: Math.max(1, v ?? 24) })} /></Field>
                <Field label="No answer in time"><Select value={s.partFill.onTimeout} disabled={dis} options={[{ value: 'ship-available', label: 'Ship what is available, backorder the rest' }, { value: 'wait', label: 'Wait for the complete order' }]} onChange={(v) => set('partFill', { ...s.partFill, onTimeout: v as 'ship-available' | 'wait' })} /></Field>
                <Field label="Backorder promise (days)"><NumberInput value={s.partFill.backorderDays} disabled={dis} onChange={(v) => set('partFill', { ...s.partFill, backorderDays: Math.max(1, v ?? 7) })} /></Field>
              </FormGrid>
            </div>
          </Card>
        )}

        {sec === 'changes' && (
          <Card title="Changes after an order is placed" subtitle="Every change is versioned on the order (v1, v2…) and the ERP sales order follows.">
            <FormGrid>
              <Field label="Partner can edit after submitting"><Select value={s.amend.partnerEditUntil} disabled={dis} options={[{ value: 'none', label: 'No' }, { value: 'approved', label: 'Until approved' }, { value: 'confirmed', label: 'Until confirmed' }]} onChange={(v) => set('amend', { ...s.amend, partnerEditUntil: v as OrderSettings['amend']['partnerEditUntil'] })} /></Field>
              <Field label="Order desk can change a confirmed order"><Select value={s.amend.deskAmendUntil} disabled={dis} options={[{ value: 'none', label: 'No' }, { value: 'picking', label: 'Until picking starts' }, { value: 'dispatch', label: 'Until dispatch (unshipped quantity)' }]} onChange={(v) => set('amend', { ...s.amend, deskAmendUntil: v as OrderSettings['amend']['deskAmendUntil'] })} /></Field>
              <Field label="Reduce quantity / remove a line"><Select value={s.amend.reduce} disabled={dis} options={[{ value: 'auto', label: 'Automatic — reservation released' }, { value: 'approval', label: 'Needs approval' }]} onChange={(v) => set('amend', { ...s.amend, reduce: v as 'auto' | 'approval' })} /></Field>
              <Field label="Increase quantity / add a line"><Select value={s.amend.increase} disabled={dis} options={[{ value: 'auto', label: 'Automatic if stock is available' }, { value: 'approval', label: 'Back for approval' }]} onChange={(v) => set('amend', { ...s.amend, increase: v as 'auto' | 'approval' })} /></Field>
              <Field label="Partner can cancel"><Select value={s.amend.partnerCancelUntil} disabled={dis} options={[{ value: 'none', label: 'No' }, { value: 'confirmed', label: 'Until confirmed' }, { value: 'dispatch', label: 'Until dispatch, with approval' }]} onChange={(v) => set('amend', { ...s.amend, partnerCancelUntil: v as OrderSettings['amend']['partnerCancelUntil'] })} /></Field>
              <Field label="Tell about every change"><Select value={s.amend.notify} disabled={dis} options={[{ value: 'both', label: 'Partner and internal team' }, { value: 'partner', label: 'Partner only' }, { value: 'internal', label: 'Internal team only' }]} onChange={(v) => set('amend', { ...s.amend, notify: v as OrderSettings['amend']['notify'] })} /></Field>
            </FormGrid>
          </Card>
        )}

        {sec === 'notify' && (
          <>
            <Card title="Sender" subtitle="Phase 1 logs every message on the order with its exact text. Sending from your own domain (Office 365, Google Workspace, SMTP) comes next.">
              <FormGrid cols={3}>
                <Field label="Display name"><Input value={s.notify.senderName} disabled={dis} onChange={(x) => set('notify', { ...s.notify, senderName: x.target.value })} /></Field>
                <Field label="From address" hint="Empty = VinFlux fallback address."><Input value={s.notify.senderEmail} disabled={dis} placeholder="orders@yourcompany.com" onChange={(x) => set('notify', { ...s.notify, senderEmail: x.target.value.trim() })} /></Field>
                <Field label="Reply-to"><Input value={s.notify.replyTo} disabled={dis} placeholder="Same as from" onChange={(x) => set('notify', { ...s.notify, replyTo: x.target.value.trim() })} /></Field>
              </FormGrid>
              <div className="g2-small g2-muted" style={{ marginTop: 6 }}>Messages go out as <span className="g2-mono">{senderOf()}</span></div>
            </Card>
            <Card title="Acknowledgement" subtitle="Sent when an order arrives.">
              <FormGrid>
                <Field label="Acknowledge orders from"><MultiSelect disabled={dis} values={s.notify.ackSources} options={['Email', 'Portal', 'Field app', 'Phone', 'Excel', 'PDF', 'EDI', 'Manual'].map((x) => ({ value: x, label: x }))} onChange={(v) => set('notify', { ...s.notify, ackSources: v })} /></Field>
                <Field label="Unreadable order or unknown sender"><Switch checked={s.notify.unreadableReply} disabled={dis} label="Reply asking for the template or portal" onChange={(v) => set('notify', { ...s.notify, unreadableReply: v })} /></Field>
              </FormGrid>
            </Card>
            <Card title="Events and templates" subtitle="Placeholders: {orderNo} {poNumber} {partnerName} {lines} {eta} {value} {reason} {changes} {actionLink} {senderName} {invoiceNo} {carrier} {awb} {shipmentNo}">
              <div className="g2-table-wrap" style={{ marginBottom: 12 }}><table className="g2-table">
                <thead><tr><th>Event</th><th>Partner</th><th>WhatsApp</th><th>Internal</th><th>To (internal)</th></tr></thead>
                <tbody>{EVENTS.map((x) => {
                  const es = s.notify.events[x.id];
                  const upd = (p: Partial<typeof es>) => set('notify', { ...s.notify, events: { ...s.notify.events, [x.id]: { ...es, ...p } } });
                  return (
                    <tr key={x.id} onClick={() => setEv(x.id)} style={{ cursor: 'pointer', background: ev === x.id ? 'var(--g2-primary-50, #eef2ff)' : undefined }}>
                      <td className="g2-strong">{x.label}</td>
                      <td onClick={(z) => z.stopPropagation()}><Switch checked={es.partner} disabled={dis} onChange={(v) => upd({ partner: v })} /></td>
                      <td onClick={(z) => z.stopPropagation()}><Switch checked={es.whatsapp} disabled={dis || !es.partner} onChange={(v) => upd({ whatsapp: v })} /></td>
                      <td onClick={(z) => z.stopPropagation()}><Switch checked={es.internal} disabled={dis} onChange={(v) => upd({ internal: v })} /></td>
                      <td className="g2-small g2-muted">{x.internalTo}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
              <div className="g2-label" style={{ marginBottom: 6 }}>Template — {EVENTS.find((x) => x.id === ev)?.label}</div>
              <Field label="Subject"><Input value={e.subject} disabled={dis} onChange={(x) => setEvent({ subject: x.target.value })} /></Field>
              <Field label="Body"><Textarea rows={8} value={e.body} disabled={dis} onChange={(x) => setEvent({ body: x.target.value })} /></Field>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} disabled={dis} onClick={() => setEvent({ subject: DEFAULT_EVENTS[ev].subject, body: DEFAULT_EVENTS[ev].body })}>Default text</Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
