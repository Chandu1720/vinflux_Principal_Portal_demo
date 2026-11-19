/**
 * Network & distributor invitations: invite by GSTIN → sign-up and KYC → verify documents → agreement e-sign → linked.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSignature, Link2, MailPlus, ShieldCheck, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, Select, Tabs } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useConfig, usePartners } from '../gtm-v2/hooks/useGtmData';
import { SANDBOX_GSTINS } from '../gtm-v2/services/gstService';
import { subscribeSecondary } from '../secondary/secondaryStore';
import { subscribeTenders } from '../tenders/tendersStore';
import { cancelInvite, ensureInviteDemo, getInvite, invite, invites, partnerOf, reupload, sendAgreement, simulateESign, simulateSignUp, stepOf, subscribeInvites, verifyDoc } from './inviteStore';
import type { Terms } from './inviteStore';

const STEPS = ['Invited', 'KYC verified', 'Agreement signed', 'Linked'];
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const InviteModal: React.FC<{ onClose: () => void; onOpen: (id: string) => void }> = ({ onClose, onOpen }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const types = (useConfig().data?.partnerTypes ?? []).filter((t) => !/hospital|institution/i.test(t.name));
  const [f, setF] = useState({ gstin: '', contact: '', email: '', phone: '', partnerTypeId: '' });
  const [errs, setErrs] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const pt = f.partnerTypeId || types.find((t) => /distributor/i.test(t.name))?.id || types[0]?.id || '';
  const go = async () => {
    setBusy(true); const r = await invite(activePrincipal.id, f.gstin, { ...f, partnerTypeId: pt }, currentUser.name); setBusy(false);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; } showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open title="Invite a distributor" subtitle="The GSTIN is checked against the GST registry; the distributor gets a link to sign up on VinFlux" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<MailPlus size={15} />} loading={busy} onClick={go}>Verify GSTIN & send invite</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t invite yet" />}
        <FormGrid>
          <Field label="GSTIN" required hint={`Sandbox: ${SANDBOX_GSTINS.filter((x) => x.status === 'Active').slice(0, 3).map((x) => x.gstin).join(', ')}`}><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="15-character GSTIN" /></Field>
          <Field label="Partner type" required><Select value={pt} options={types.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setF({ ...f, partnerTypeId: v })} /></Field>
          <Field label="Contact person" required><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
          <Field label="E-mail" required><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </FormGrid>
      </div>
    </Modal>
  );
};

const InviteDrawer: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  useSubscribe(subscribeInvites, subscribeTenders, subscribeSecondary);
  usePartners();
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const docTypes = useConfig().data?.kycDocuments ?? [];
  const i = getInvite(id);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [t, setT] = useState<Terms>({ territory: '', brands: 'All brands', creditLimit: 2500000, marginPct: 12, paymentDays: 30, from: addDays(0), to: addDays(364) });
  const [errs, setErrs] = useState<string[]>([]);
  if (!i) return null;
  const p = partnerOf(i); const st = stepOf(i);
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok && r.errors) setErrs(r.errors); else { setErrs([]); showToast(r.message, r.ok ? 'success' : 'warning'); } return r.ok; };
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{i.name} <Badge tone={st.tone} dot>{st.label}</Badge></span>} subtitle={`${i.no} · GSTIN ${i.gstin} · ${i.gst.state} · ${i.contact}, ${i.email}`} onClose={onClose}>
      <div className="g2-stack">
        <div className="nw-steps">{STEPS.map((s, k) => <div key={s} className={`nw-step ${st.n > k + 1 || st.n === 4 || (st.step === 'Setup' && k <= 2) ? 'done' : ''} ${(st.step === 'Setup' ? k === 3 : st.n === k + 1 && st.n !== 4) ? 'cur' : ''}`}><span>{k + 1}</span>{s}</div>)}</div>
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        <Card title="From the GST registry"><div className="g2-grid g2-grid-3 g2-small">
          <div><div className="g2-muted">Legal name</div>{i.gst.legalName}</div><div><div className="g2-muted">Registration</div>{i.gst.status} · {i.gst.taxpayerType} · since {i.gst.registrationDate}</div><div><div className="g2-muted">PAN</div>{i.gst.pan}</div>
          <div style={{ gridColumn: 'span 3' }}><div className="g2-muted">Address</div>{i.gst.address.line1}, {i.gst.address.city}, {i.gst.address.state} {i.gst.address.pincode}</div>
        </div></Card>

        {i.stage === 'Invited' && (
          <Card title="Waiting for the distributor" subtitle={`Sign-up link sent to ${i.email}`}>
            <div className="g2-small g2-mono" style={{ marginBottom: 10 }}>{i.link}</div>
            <div className="g2-card" style={{ padding: 10, background: '#fafaf9', boxShadow: 'none' }}>
              <div className="g2-small g2-muted" style={{ marginBottom: 6 }}>Demo only — what the distributor does:</div>
              <Button size="sm" variant="success" onClick={() => tell(simulateSignUp(i.id))}>Sign up, upload KYC and share data</Button>
            </div>
          </Card>
        )}

        {p && (
          <Card title="KYC documents" subtitle="Verify each one; a rejection goes back to the distributor with your reason" flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Document</th><th>File</th><th>Status</th><th /></tr></thead>
              <tbody>{p.kycDocuments.map((d) => (
                <tr key={d.id}>
                  <td>{docTypes.find((x) => x.id === d.docTypeId)?.name ?? d.docTypeId}{d.validUntil && <div className="g2-cell-sub">{d.documentNo} · valid until {d.validUntil}</div>}</td>
                  <td className="g2-small g2-mono">{d.fileName}</td>
                  <td><Badge tone={d.status === 'Verified' ? 'green' : d.status === 'Rejected' ? 'red' : 'amber'} dot>{d.status}</Badge>{d.status === 'Rejected' && <div className="g2-cell-sub">{d.remarks}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {d.status === 'Under Review' && <div className="g2-row" style={{ gap: 6 }}>
                      <div style={{ width: 150 }}><Input value={why[d.id] ?? ''} placeholder="Reason to reject" onChange={(e) => setWhy({ ...why, [d.id]: e.target.value })} /></div>
                      <Button size="sm" onClick={() => tell(verifyDoc(i.id, d.id, false, currentUser.name, why[d.id] ?? ''))}>Reject</Button>
                      <Button size="sm" variant="success" onClick={() => tell(verifyDoc(i.id, d.id, true, currentUser.name))}>Verify</Button></div>}
                    {d.status === 'Rejected' && <Button size="sm" onClick={() => tell(reupload(i.id, d.id))}>Demo: distributor re-uploads</Button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
        )}

        {i.stage === 'Signed up' && st.step === 'Agreement' && (
          <Card title={<span className="g2-row" style={{ gap: 6 }}><FileSignature size={15} /> Agreement</span>} subtitle="Saved in Tenders & Agreements and sent to the distributor for e-sign">
            <FormGrid cols={3}>
              <Field label="Territory" required><Input value={t.territory} onChange={(e) => setT({ ...t, territory: e.target.value })} placeholder={`e.g. ${i.gst.address.city}`} /></Field>
              <Field label="Brands / products"><Input value={t.brands} onChange={(e) => setT({ ...t, brands: e.target.value })} /></Field>
              <Field label="Credit limit (₹)" required><NumberInput value={t.creditLimit} onChange={(v) => setT({ ...t, creditLimit: v ?? 0 })} /></Field>
              <Field label="Margin %" required><NumberInput value={t.marginPct} onChange={(v) => setT({ ...t, marginPct: v ?? 0 })} /></Field>
              <Field label="Payment days"><NumberInput value={t.paymentDays} onChange={(v) => setT({ ...t, paymentDays: v ?? 0 })} /></Field>
              <Field label="Valid to"><Input type="date" value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })} /></Field>
            </FormGrid>
            <div style={{ marginTop: 12 }}><Button variant="primary" icon={<FileSignature size={15} />} onClick={() => tell(sendAgreement(i.id, t, currentUser.name))}>Send for e-sign</Button></div>
          </Card>
        )}
        {i.stage === 'Agreement sent' && (
          <Card title="Agreement out for e-sign" subtitle={i.terms ? `${i.terms.territory} · ${i.terms.brands} · ₹${i.terms.creditLimit.toLocaleString('en-IN')} credit · ${i.terms.marginPct}% margin · ${i.terms.paymentDays} days` : ''}>
            <div className="g2-card" style={{ padding: 10, background: '#fafaf9', boxShadow: 'none' }}>
              <div className="g2-small g2-muted" style={{ marginBottom: 6 }}>Demo only — what the distributor does:</div>
              <Button size="sm" variant="success" onClick={() => tell(simulateESign(i.id))}>E-sign the agreement (Aadhaar eSign)</Button>
            </div>
          </Card>
        )}
        {i.stage === 'Signed' && st.step === 'Setup' && p && (
          <Alert tone="info">Signed by {i.signedBy} on {i.signedAt?.slice(0, 10)}. Assign territories and the sales policy in Partners and submit it — the partner becomes Active through your usual approval, and the link is complete.
            <div style={{ marginTop: 8 }}><Button size="sm" variant="primary" onClick={() => navigate(`/gtm-v2/partners/onboard/${p.id}`)}>Finish setup in Partners</Button></div></Alert>
        )}
        {st.step === 'Linked' && <Alert tone="success">Linked — {i.name} is Active, the agreement is signed and it shares data with you. <a href="#" onClick={(e) => { e.preventDefault(); navigate('/consent'); }}>See what it shares</a>.</Alert>}
        {!['Signed', 'Cancelled'].includes(i.stage) && <div><Button size="sm" variant="danger" onClick={() => tell(cancelInvite(i.id, currentUser.name, 'Cancelled by the principal'))}>Cancel invitation</Button></div>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{i.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>
      </div>
    </Modal>
  );
};

const NetworkPage: React.FC = () => {
  useSubscribe(subscribeInvites, subscribeTenders);
  usePartners();
  const { activePrincipal } = useApp();
  const types = useConfig().data?.partnerTypes ?? [];
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [inv, setInv] = useState(false);
  useEffect(() => { if (types.length) void ensureInviteDemo(activePrincipal.id); }, [types.length, activePrincipal.id]);
  const all = invites(activePrincipal.id);
  const by = (s: string) => all.filter((i) => stepOf(i).step === s && i.stage !== 'Cancelled');
  const rows = tab === 'all' ? all : tab === 'cancelled' ? all.filter((i) => i.stage === 'Cancelled') : by(tab);
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Network & Invitations" description="Invite distributors and C&Fs by GSTIN. They sign up on VinFlux and upload KYC; you verify, send the agreement (territory, brands, credit, margin) for e-sign, and they are linked — sharing data with you from day one."
        actions={<Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setInv(true)}>Invite distributor</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Invited" value={by('Invited').length} icon={<MailPlus size={22} />} color="#2563eb" bg="#eaf1ff" foot="waiting for sign-up" onClick={() => setTab('Invited')} />
        <KpiCard label="KYC to verify" value={by('KYC').length} icon={<ShieldCheck size={22} />} color="#c77700" bg="#fff5e0" foot="documents uploaded" onClick={() => setTab('KYC')} />
        <KpiCard label="Agreement / setup" value={by('Agreement').length + by('Setup').length} icon={<FileSignature size={22} />} color="#7c3aed" bg="#f1ebfd" foot="to send, out for e-sign or to finish" onClick={() => setTab('Agreement')} />
        <KpiCard label="Linked" value={by('Linked').length} icon={<Link2 size={22} />} color="#15803d" bg="#e7f7ee" foot="active and sharing data" onClick={() => setTab('Linked')} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: all.length }, { id: 'Invited', label: 'Invited' }, { id: 'KYC', label: 'KYC' }, { id: 'Agreement', label: 'Agreement' }, { id: 'Setup', label: 'Setup' }, { id: 'Linked', label: 'Linked' }, { id: 'cancelled', label: 'Cancelled' }]} /></div>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Distributor</th><th>GSTIN</th><th>Type</th><th>Invited</th><th>Progress</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="g2-muted">No invitations here.</td></tr>}
            {rows.map((i) => { const st = stepOf(i); return (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(i.id)}>
                <td><strong>{i.name}</strong><div className="g2-cell-sub">{i.contact} · {i.phone || i.email}</div></td>
                <td className="g2-mono g2-small">{i.gstin}<div className="g2-cell-sub">{i.gst.state}</div></td>
                <td className="g2-small">{types.find((x) => x.id === i.partnerTypeId)?.name ?? '—'}</td>
                <td className="g2-small">{i.history[0]?.at.slice(0, 10)}</td>
                <td className="g2-small">{i.stage === 'Cancelled' ? '—' : `Step ${st.n} of 4`}<div className="nw-bar"><div style={{ width: `${(st.n / 4) * 100}%`, background: st.n === 4 ? '#15803d' : '#2563eb' }} /></div></td>
                <td><Badge tone={st.tone} dot>{st.label}</Badge></td>
              </tr>
            ); })}
          </tbody>
        </table></div>
      </Card>
      {inv && <InviteModal onClose={() => setInv(false)} onOpen={setOpen} />}
      {open && <InviteDrawer id={open} onClose={() => setOpen(null)} />}
      <style>{`
        .nw-bar{height:5px;background:#eef1f6;border-radius:4px;margin-top:4px;width:110px;overflow:hidden}.nw-bar>div{height:100%}
        .nw-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .nw-step{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:#6b7590;padding:8px 10px;border:1px solid #e4e8f0;border-radius:8px;background:#fff}
        .nw-step span{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#eef1f6;font-size:11px}
        .nw-step.done{color:#15803d;border-color:#bbe5c8;background:#f3fbf6}.nw-step.done span{background:#15803d;color:#fff}
        .nw-step.cur{color:#2563eb;border-color:#bcd0fb;background:#f5f8ff}.nw-step.cur span{background:#2563eb;color:#fff}
        @media (max-width: 700px){ .nw-steps{grid-template-columns:1fr 1fr} }
      `}</style>
    </div>
  );
};
export default NetworkPage;
