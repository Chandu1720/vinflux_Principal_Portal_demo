/**
 * Tenders and channel agreements (IN2).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { BellRing, FileSignature, Gavel, Plus, Trash2, Trophy } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, Select, Switch, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import { subscribePricing } from '../pricing/pricingStore';
import {
  agreements as allAgreements, amendAgreement, approveAward, approveBidPrice, blankAgreement, blankTender, ensureTendersDemo, getTender, recordOutcome, reminders, saveAgreement, saveTender,
  saveTenderSettings, setAward, setEmdRefund, stateOf, submitBid, subscribeTenders, tenderSettings, tenders as allTenders,
} from './tendersStore';
import type { Agreement, AgreementType, Portal, Tender, TenderStatus } from './tendersStore';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const TONE: Record<TenderStatus, BadgeTone> = { Registered: 'slate', 'Bid submitted': 'blue', Won: 'green', Lost: 'red', Cancelled: 'slate', Awarded: 'purple' };
const PORTALS: Portal[] = ['GeM', 'State medical corporation', 'Hospital tender', 'PSU / Railways', 'Other'];
const ATYPES: AgreementType[] = ['Distributor', 'Dealer', 'C&F', 'Consignment', 'Contract manufacturing'];
const value = (t: Tender) => t.lines.reduce((a, l) => a + l.qty * l.offeredPrice, 0);

const TenderModal: React.FC<{ id: string | null; onClose: () => void; canEdit: boolean }> = ({ id, onClose, canEdit }) => {
  useSubscribe(subscribeTenders);
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const partners = usePartners().data ?? [];
  const hospitals = partners.filter((p) => p.institution);
  const saved = id ? getTender(id) : null;
  const [t, setT] = useState<Tender>(saved ?? blankTender(activePrincipal.id, currentUser.name));
  const [errs, setErrs] = useState<string[]>([]);
  const [out, setOut] = useState({ winningPrice: 0, winner: '', reason: '' });
  const [aw, setAw] = useState({ validFrom: new Date().toISOString().slice(0, 10), validTo: '', supplyingPartnerId: '', pbgAmount: 0, pbgExpiry: '' });
  const cur = (id ? getTender(id) : null) ?? t;
  const editable = canEdit && cur.status === 'Registered';
  const tell = (r: { ok: boolean; message: string; errors?: string[]; id?: string }, close = false) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { setErrs([]); showToast(r.message, 'success'); if (r.id && !id) onClose(); if (close) onClose(); } return r.ok; };
  useEffect(() => { if (id) { const x = getTender(id); if (x) setT(x); } }, [id, cur.status, cur.priceApprovedBy, cur.award?.rateContractId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open size="xl" title={id ? <span className="g2-row" style={{ gap: 8 }}>{cur.no} · {cur.buyer} <Badge tone={TONE[cur.status]} dot>{cur.status}</Badge></span> : 'Register a tender'}
      subtitle={id ? `${cur.portal} ${cur.tenderNo} · bid due ${cur.dueDate} · value ${inr(value(cur))}` : 'Buyer, tender number, products and quantities, dates, deposit'} onClose={onClose}
      footer={<>
        {editable && <Button onClick={() => tell(saveTender(t, currentUser.name))}>Save</Button>}
        {id && editable && !cur.priceApprovedBy && <Button onClick={() => tell(approveBidPrice(cur.id, currentUser.name))}>Approve bid prices</Button>}
        {id && editable && cur.priceApprovedBy && <Button variant="primary" icon={<Gavel size={15} />} onClick={() => tell(submitBid(cur.id, currentUser.name))}>Bid submitted</Button>}
        {cur.award && !cur.award.rateContractId && canEdit && <Button variant="primary" icon={<Trophy size={15} />} onClick={() => tell(approveAward(cur.id, currentUser.name, products))}>Approve prices → rate contract</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        {cur.award?.rateContractId && <Alert tone="success">Rate contract <Link to="/pricing">RC-{cur.no}</Link> is active {cur.award.validFrom} → {cur.award.validTo} (prices approved by {cur.award.approvedBy}). Orders from {cur.buyer} get these prices.</Alert>}
        {id && cur.status === 'Registered' && <Alert tone={cur.priceApprovedBy ? 'success' : 'info'}>{cur.priceApprovedBy ? `Bid prices approved by ${cur.priceApprovedBy}.` : 'Bid prices need approval by someone other than who priced them before the bid goes in.'}</Alert>}
        <FormGrid cols={3}>
          <Field label="Buyer" required><Input value={t.buyer} disabled={!editable} onChange={(e) => setT({ ...t, buyer: e.target.value })} /></Field>
          <Field label="Linked hospital / institution" hint="Needed to create the rate contract"><SearchableSelect value={t.buyerPartnerId} disabled={!editable && !(cur.status === 'Won' && !cur.award?.rateContractId)} clearable options={hospitals.map((h) => ({ value: h.id, label: h.name, description: h.code }))} onChange={(v) => { const x = { ...t, buyerPartnerId: v, buyer: t.buyer || hospitals.find((h) => h.id === v)?.name || '' }; setT(x); if (id && !editable) saveTender(x, currentUser.name); }} /></Field>
          <Field label="Portal"><Select value={t.portal} disabled={!editable} options={PORTALS.map((p) => ({ value: p, label: p }))} onChange={(v) => setT({ ...t, portal: v as Portal })} /></Field>
          <Field label="Tender number" required><Input value={t.tenderNo} disabled={!editable} onChange={(e) => setT({ ...t, tenderNo: e.target.value })} /></Field>
          <Field label="Bid due"><Input type="date" value={t.dueDate} disabled={!editable} onChange={(e) => setT({ ...t, dueDate: e.target.value })} /></Field>
          <Field label="Pre-bid meeting"><Input type="date" value={t.prebidDate ?? ''} disabled={!editable} onChange={(e) => setT({ ...t, prebidDate: e.target.value || null })} /></Field>
          <Field label="Earnest money (₹)"><NumberInput value={t.emd.amount} disabled={!editable} onChange={(v) => setT({ ...t, emd: { ...t.emd, amount: v ?? 0 } })} /></Field>
          <Field label="Mode"><Select value={t.emd.mode} disabled={!editable} options={['DD', 'BG', 'Online', 'Exempt (MSE)'].map((x) => ({ value: x, label: x }))} onChange={(v) => setT({ ...t, emd: { ...t.emd, mode: v as Tender['emd']['mode'] } })} /></Field>
          <Field label="Deposit / guarantee valid until"><Input type="date" value={t.emd.expiry ?? ''} disabled={!editable} onChange={(e) => setT({ ...t, emd: { ...t.emd, expiry: e.target.value || null } })} /></Field>
        </FormGrid>
        <Card title="Products and offered prices" actions={editable ? <Button size="sm" icon={<Plus size={13} />} onClick={() => setT({ ...t, lines: [...t.lines, { productId: '', name: '', qty: 1, offeredPrice: 0 }] })}>Add product</Button> : undefined} flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 150 }}>Offered price (₹)</th><th style={{ textAlign: 'right' }}>MRP</th><th style={{ textAlign: 'right' }}>Value</th><th /></tr></thead>
            <tbody>{t.lines.map((l, i) => { const p = products.find((x) => x.id === l.productId); return (
              <tr key={i}>
                <td>{editable ? <SearchableSelect value={l.productId || null} options={products.map((x) => ({ value: x.id, label: x.name, description: x.code }))} onChange={(v) => setT({ ...t, lines: t.lines.map((y, k) => (k === i ? { ...y, productId: v ?? '', name: products.find((x) => x.id === v)?.name ?? '' } : y)) })} /> : l.name}</td>
                <td>{editable ? <NumberInput value={l.qty} onChange={(v) => setT({ ...t, lines: t.lines.map((y, k) => (k === i ? { ...y, qty: v ?? 0 } : y)) })} /> : l.qty}</td>
                <td>{editable ? <NumberInput value={l.offeredPrice} onChange={(v) => setT({ ...t, lines: t.lines.map((y, k) => (k === i ? { ...y, offeredPrice: v ?? 0 } : y)) })} /> : l.offeredPrice.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'right' }} className="g2-small">{p?.pricingReference?.mrp ? `₹${p.pricingReference.mrp.toLocaleString('en-IN')}` : '—'}{p?.pricingReference?.mrp && l.offeredPrice ? <div className="g2-cell-sub">{Math.round((l.offeredPrice / p.pricingReference.mrp) * 100)}% of MRP</div> : null}</td>
                <td style={{ textAlign: 'right' }}>{inr(l.qty * l.offeredPrice)}</td>
                <td>{editable && <Button size="sm" icon={<Trash2 size={13} />} onClick={() => setT({ ...t, lines: t.lines.filter((_, k) => k !== i) })} />}</td>
              </tr>
            ); })}</tbody>
          </table></div>
        </Card>
        {cur.status === 'Bid submitted' && canEdit && (
          <Card title="Outcome">
            <FormGrid cols={3}>
              <Field label="Winner (if lost)"><Input value={out.winner} onChange={(e) => setOut({ ...out, winner: e.target.value })} /></Field>
              <Field label="Winning price (if known)"><NumberInput value={out.winningPrice} onChange={(v) => setOut({ ...out, winningPrice: v ?? 0 })} /></Field>
              <Field label="Note"><Input value={out.reason} onChange={(e) => setOut({ ...out, reason: e.target.value })} /></Field>
            </FormGrid>
            <div className="g2-row" style={{ gap: 8, marginTop: 10 }}>
              <Button variant="success" onClick={() => tell(recordOutcome(cur.id, 'Won', { ...out, winningPrice: out.winningPrice || null }, currentUser.name))}>Won</Button>
              <Button variant="danger" onClick={() => tell(recordOutcome(cur.id, 'Lost', { ...out, winningPrice: out.winningPrice || null }, currentUser.name))}>Lost</Button>
              <Button onClick={() => tell(recordOutcome(cur.id, 'Cancelled', { ...out, winningPrice: null }, currentUser.name))}>Cancelled</Button>
            </div>
          </Card>
        )}
        {cur.status === 'Won' && !cur.award && canEdit && (
          <Card title="Award">
            <FormGrid cols={3}>
              <Field label="Contract from"><Input type="date" value={aw.validFrom} onChange={(e) => setAw({ ...aw, validFrom: e.target.value })} /></Field>
              <Field label="Contract to" required><Input type="date" value={aw.validTo} onChange={(e) => setAw({ ...aw, validTo: e.target.value })} /></Field>
              <Field label="Supplying partner"><SearchableSelect value={aw.supplyingPartnerId || null} clearable options={partners.filter((p) => !p.institution).map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setAw({ ...aw, supplyingPartnerId: v ?? '' })} /></Field>
              <Field label="Performance guarantee (₹)"><NumberInput value={aw.pbgAmount} onChange={(v) => setAw({ ...aw, pbgAmount: v ?? 0 })} /></Field>
              <Field label="Guarantee valid until"><Input type="date" value={aw.pbgExpiry} onChange={(e) => setAw({ ...aw, pbgExpiry: e.target.value })} /></Field>
            </FormGrid>
            <div style={{ marginTop: 10 }}><Button variant="primary" onClick={() => tell(setAward(cur.id, { validFrom: aw.validFrom, validTo: aw.validTo, supplyingPartnerId: aw.supplyingPartnerId || null, pbg: aw.pbgAmount ? { amount: aw.pbgAmount, expiry: aw.pbgExpiry || null } : null, contractQty: {}, markedBy: currentUser.name, approvedBy: null, rateContractId: null }, currentUser.name))}>Record award</Button></div>
          </Card>
        )}
        {cur.award && <Alert tone={cur.award.rateContractId ? 'success' : 'info'}>Awarded {cur.award.validFrom} → {cur.award.validTo}{cur.award.supplyingPartnerId ? ` · supplied through ${partners.find((p) => p.id === cur.award!.supplyingPartnerId)?.name}` : ''}{cur.award.pbg ? ` · performance guarantee ₹${cur.award.pbg.amount.toLocaleString('en-IN')} until ${cur.award.pbg.expiry}` : ''}. Recorded by {cur.award.markedBy}{cur.award.rateContractId ? '' : ' — waiting for a second person to approve the prices (TND-01).'}</Alert>}
        {id && cur.emd.amount > 0 && ['Lost', 'Cancelled', 'Awarded'].includes(cur.status) && canEdit && (
          <div className="g2-row" style={{ gap: 8 }}><span className="g2-small">Earnest money: <strong>{cur.emd.refund}</strong></span>{cur.emd.refund === 'Pending' && <Button size="sm" onClick={() => setEmdRefund(cur.id, 'Refunded', currentUser.name)}>Mark refunded</Button>}</div>
        )}
        {id && <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{cur.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>}
      </div>
    </Modal>
  );
};

const AgreementModal: React.FC<{ a: Agreement | null; onClose: () => void; canEdit: boolean }> = ({ a, onClose, canEdit }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const partners = usePartners().data ?? [];
  const [x, setX] = useState<Agreement>(a ?? blankAgreement(activePrincipal.id, currentUser.name));
  const [amend, setAmend] = useState<{ from: string; to: string; note: string } | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const ro = !canEdit || !!a;
  return (
    <Modal open size="lg" title={a ? <span className="g2-row" style={{ gap: 8 }}>{a.no} · {a.partyName} <Badge tone={{ Active: 'green', Expiring: 'amber', Expired: 'red', 'Not started': 'slate' }[stateOf(a)] as BadgeTone}>{stateOf(a)}</Badge></span> : 'New agreement'}
      subtitle={a ? `${a.type} · version ${a.version} · ${a.from} → ${a.to}` : 'Distributor, dealer, C&F, consignment or contract-manufacturing agreement'} onClose={onClose}
      footer={<>
        {!a && canEdit && <Button variant="primary" onClick={() => { const r = saveAgreement(x, currentUser.name); if (!r.ok) setErrs(r.errors ?? [r.message]); else { showToast(r.message, 'success'); onClose(); } }}>Save</Button>}
        {a && canEdit && !amend && <Button variant="primary" onClick={() => setAmend({ from: new Date().toISOString().slice(0, 10), to: a.to > new Date().toISOString().slice(0, 10) ? a.to : new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), note: '' })}>Renew / amend</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t save" />}
        <FormGrid cols={3}>
          <Field label="Type"><Select value={x.type} disabled={ro} options={ATYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setX({ ...x, type: v as AgreementType })} /></Field>
          <Field label="Partner" required><SearchableSelect value={x.partyId || null} disabled={ro} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setX({ ...x, partyId: v ?? '', partyName: partners.find((p) => p.id === v)?.name ?? '' })} /></Field>
          <Field label="Signed copy"><Input value={x.signedCopy ?? ''} disabled={ro} placeholder="file name" onChange={(e) => setX({ ...x, signedCopy: e.target.value || null })} /></Field>
          <Field label="From"><Input type="date" value={x.from} disabled={ro} onChange={(e) => setX({ ...x, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={x.to} disabled={ro} onChange={(e) => setX({ ...x, to: e.target.value })} /></Field>
          <Field label="Exclusive"><Switch checked={x.exclusivity} disabled={ro} onChange={(v) => setX({ ...x, exclusivity: v })} label="Exclusive" /></Field>
          <Field label="Products"><Input value={x.products} disabled={ro} onChange={(e) => setX({ ...x, products: e.target.value })} /></Field>
          <Field label="Targets"><Input value={x.targets} disabled={ro} onChange={(e) => setX({ ...x, targets: e.target.value })} /></Field>
          <Field label="Credit terms / fee"><Input value={x.creditTerms} disabled={ro} onChange={(e) => setX({ ...x, creditTerms: e.target.value })} /></Field>
        </FormGrid>
        <Field label="Other terms" hint="C&F: depot, services, fee, stock responsibility, insurance · Consignment: stock placed, count frequency, billing on use"><Textarea rows={2} value={x.extra} disabled={ro} onChange={(e) => setX({ ...x, extra: e.target.value })} /></Field>
        {amend && a && (
          <Card title="New version" subtitle="Takes effect on the date you choose; orders before it keep the old terms (TND-05)">
            <FormGrid cols={3}>
              <Field label="Effective from"><Input type="date" value={amend.from} onChange={(e) => setAmend({ ...amend, from: e.target.value })} /></Field>
              <Field label="Valid until"><Input type="date" value={amend.to} onChange={(e) => setAmend({ ...amend, to: e.target.value })} /></Field>
              <Field label="What changed"><Input value={amend.note} onChange={(e) => setAmend({ ...amend, note: e.target.value })} /></Field>
            </FormGrid>
            <div className="g2-small g2-muted" style={{ margin: '6px 0' }}>Edit any term above before saving — the new version carries it.</div>
            <div className="g2-row" style={{ gap: 8 }}><Button onClick={() => setAmend(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = amendAgreement(a.id, { ...x, to: amend.to }, amend.from, currentUser.name, amend.note); if (!r.ok) setErrs([r.message]); else { showToast(r.message, 'success'); onClose(); } }}>Save new version</Button></div>
          </Card>
        )}
        {a && (
          <Card title="Versions" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>v</th><th>Valid</th><th>Terms</th><th>By</th></tr></thead>
            <tbody>{[...a.versions].reverse().map((v) => <tr key={v.v}><td>{v.v}</td><td className="g2-small">{v.from} → {v.to}</td><td className="g2-small">{v.terms}</td><td className="g2-small">{v.by}</td></tr>)}</tbody></table></div></Card>
        )}
      </div>
    </Modal>
  );
};

const TendersPage: React.FC = () => {
  useSubscribe(subscribeTenders, subscribePricing);
  const { activePrincipal, currentUser, products } = useApp();
  const partnersAll = usePartners().data ?? [];
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'tenders';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [open, setOpen] = useState<string | null | 'new'>(null);
  const [agr, setAgr] = useState<Agreement | null | 'new'>(null);
  const m = currentUser.matrix; const admin = !m || (currentUser.role ?? '').includes('Administrator');
  const canEdit = admin || !!m?.pricing?.includes('edit') || !!m?.gtm?.includes('edit');
  const hospitals = useMemo(() => partnersAll.filter((p) => p.institution), [partnersAll]);
  useEffect(() => {
    if (!partnersAll.length || !products.length) return;
    const typeOf = (pt: string): AgreementType => (pt === 'pt-cnf' ? 'C&F' : pt === 'pt-dealer' ? 'Dealer' : 'Distributor');
    ensureTendersDemo(activePrincipal.id, hospitals.map((h) => ({ id: h.id, name: h.name })), partnersAll.filter((p) => !p.institution && p.status === 'Active').map((p) => ({ id: p.id, name: p.name, type: typeOf(p.partnerTypeId) })), products.filter((p) => p.lifecycleStatus === 'Active'), 'System');
  }, [partnersAll.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ts = allTenders(activePrincipal.id); const ag = allAgreements(activePrincipal.id); const rem = reminders(activePrincipal.id); const s = tenderSettings();
  const live = ts.filter((t) => ['Registered', 'Bid submitted'].includes(t.status));
  const decided = ts.filter((t) => ['Won', 'Lost', 'Awarded'].includes(t.status));
  const winRate = decided.length ? Math.round((decided.filter((t) => t.status !== 'Lost').length / decided.length) * 100) : null;
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Tenders & Agreements" description="Institutional tenders from bid to rate contract, and the agreements with your channel — with deposit, guarantee and renewal reminders."
        actions={canEdit ? <><Button icon={<FileSignature size={15} />} onClick={() => setAgr('new')}>New agreement</Button><Button variant="primary" icon={<Plus size={15} />} onClick={() => setOpen('new')}>Register tender</Button></> : undefined} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Live bids" value={live.length} icon={<Gavel size={22} />} color="#2563eb" bg="#eff6ff" foot={inr(live.reduce((a, t) => a + value(t), 0)) + ' in play'} />
        <KpiCard label="Win rate" value={winRate === null ? '—' : `${winRate}%`} icon={<Trophy size={22} />} color="#059669" bg="#ecfdf5" foot={`${decided.length} decided`} />
        <KpiCard label="Agreements expiring" value={ag.filter((a) => ['Expiring', 'Expired'].includes(stateOf(a))).length} icon={<FileSignature size={22} />} color="#d97706" bg="#fffbeb" foot={`${ag.filter((a) => stateOf(a) === 'Expired').length} already expired`} onClick={() => setTab('agreements')} />
        <KpiCard label="Reminders" value={rem.length} icon={<BellRing size={22} />} color="#dc2626" bg="#fef2f2" foot={`${rem.filter((r) => r.overdue).length} overdue`} onClick={() => setTab('reminders')} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'tenders', label: 'Tenders', count: ts.length || undefined }, { id: 'agreements', label: 'Agreements', count: ag.length || undefined }, { id: 'reminders', label: 'Reminders', count: rem.length || undefined }, { id: 'settings', label: 'Settings' }]} /></div>
        {tab === 'tenders' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Tender</th><th>Buyer</th><th>Portal</th><th>Bid due</th><th style={{ textAlign: 'right' }}>Value</th><th>Deposit</th><th>Status</th></tr></thead>
            <tbody>{ts.length === 0 && <tr><td colSpan={7} className="g2-muted">No tenders yet.</td></tr>}
              {ts.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(t.id)}>
                  <td className="g2-mono">{t.no}<div className="g2-cell-sub">{t.tenderNo}</div></td><td>{t.buyer}</td><td className="g2-small">{t.portal}</td>
                  <td className="g2-small" style={{ color: t.status === 'Registered' && t.dueDate < new Date().toISOString().slice(0, 10) ? '#b91c1c' : undefined }}>{t.dueDate}</td>
                  <td style={{ textAlign: 'right' }}>{inr(value(t))}</td>
                  <td className="g2-small">{t.emd.amount ? `₹${t.emd.amount.toLocaleString('en-IN')} · ${t.emd.refund}` : t.emd.mode}</td>
                  <td><Badge tone={TONE[t.status]} dot>{t.status}</Badge>{t.status === 'Won' && t.award && !t.award.rateContractId && <div className="g2-cell-sub">prices to approve</div>}</td>
                </tr>
              ))}</tbody>
          </table></div>
        )}
        {tab === 'agreements' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Agreement</th><th>Partner</th><th>Type</th><th>Valid</th><th>Terms</th><th>State</th></tr></thead>
            <tbody>{ag.length === 0 && <tr><td colSpan={6} className="g2-muted">No agreements yet.</td></tr>}
              {ag.map((a) => { const st = stateOf(a); return (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setAgr(a)}>
                  <td className="g2-mono">{a.no}<div className="g2-cell-sub">v{a.version}{a.signedCopy ? ' · signed' : ' · not signed'}</div></td><td>{a.partyName}</td><td className="g2-small">{a.type}{a.exclusivity ? ' · exclusive' : ''}</td>
                  <td className="g2-small">{a.from} → {a.to}</td><td className="g2-small">{[a.products, a.targets, a.creditTerms].filter(Boolean).join(' · ')}</td>
                  <td><Badge tone={st === 'Active' ? 'green' : st === 'Expiring' ? 'amber' : st === 'Expired' ? 'red' : 'slate'} dot>{st}</Badge></td>
                </tr>
              ); })}</tbody>
          </table></div>
        )}
        {tab === 'reminders' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Due</th><th>What</th><th>Record</th></tr></thead>
            <tbody>{rem.length === 0 && <tr><td colSpan={3} className="g2-muted">Nothing due.</td></tr>}
              {rem.map((r, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => (r.kind === 'Renewal' ? setAgr(ag.find((a) => a.id === r.refId) ?? null) : setOpen(r.refId))}>
                  <td style={{ color: r.overdue ? '#b91c1c' : undefined, fontWeight: r.overdue ? 600 : undefined }}>{r.date}{r.overdue ? ' · overdue' : ''}</td>
                  <td><Badge tone={r.kind === 'Renewal' ? 'amber' : r.kind === 'Bid due' ? 'blue' : 'purple'}>{r.kind}</Badge> {r.text}</td><td className="g2-mono g2-small">{r.ref}</td>
                </tr>
              ))}</tbody>
          </table></div>
        )}
        {tab === 'settings' && (
          <div style={{ padding: 16 }}>
            <FormGrid cols={3}>
              <Field label="Remind agreement renewals (days before)"><NumberInput value={s.renewalDays} disabled={!admin} onChange={(v) => saveTenderSettings({ ...s, renewalDays: Math.max(1, v ?? 60) })} /></Field>
              <Field label="Remind deposits and guarantees (days before)"><NumberInput value={s.reminderDays} disabled={!admin} onChange={(v) => saveTenderSettings({ ...s, reminderDays: Math.max(1, v ?? 30) })} /></Field>
              <Field label="Orders when the partner’s agreement has expired"><Select value={s.expiredAgreement} disabled={!admin} options={[{ value: 'warn', label: 'Warn' }, { value: 'block', label: 'Block' }, { value: 'off', label: 'Don’t check' }]} onChange={(v) => saveTenderSettings({ ...s, expiredAgreement: v as typeof s.expiredAgreement })} /></Field>
            </FormGrid>
          </div>
        )}
      </Card>
      {open && <TenderModal id={open === 'new' ? null : open} canEdit={canEdit} onClose={() => setOpen(null)} />}
      {agr && <AgreementModal a={agr === 'new' ? null : agr} canEdit={canEdit} onClose={() => setAgr(null)} />}
    </div>
  );
};
export default TendersPage;
