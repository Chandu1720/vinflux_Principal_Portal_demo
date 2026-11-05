import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Alert, Button, Checkbox, ErrorList, Field, FormGrid, Input, Modal, SearchableSelect, Segmented, Select, Textarea } from '../../components/ui';
import { coverageService } from '../../services';
import type { TransferInput } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { assignmentState, ownerName, todayStr } from '../../utils/coverage';
import type { CustomerAssignment, HandoverChecklist } from '../../types';
import type { GtmBundle } from '../partner-onboarding/stepProps';
import { candidatePartners } from './model';

const HANDOVER: { key: keyof HandoverChecklist; label: string; hint: string }[] = [
  { key: 'openOrders', label: 'Open orders', hint: 'Delivered, cancelled or moved to the new owner' },
  { key: 'stockAtPartner', label: 'Stock held for this hospital', hint: 'Returned, bought back or transferred' },
  { key: 'consignmentKits', label: 'Consignment / loaner kits at the hospital', hint: 'Counted and handed over' },
  { key: 'pendingClaims', label: 'Pending claims', hint: 'Schemes, price differences, damages settled' },
  { key: 'receivables', label: 'Receivables', hint: 'Partner’s dues from this hospital agreed' },
];

/** Transfer / remove: ends the current owner and starts the new one on the same date, after approval. */
export const TransferDrawer: React.FC<{ data: GtmBundle; assignment: CustomerAssignment; portfolioName: string; onClose: () => void }> = ({ data, assignment, portfolioName, onClose }) => {
  const { actor, principal } = useGtmAuth();
  const { run, pending, errors } = useAction();
  const config = data.config!;
  const hospital = data.partners.find((p) => p.id === assignment.customerId);
  const hasBackup = assignment.role === 'PRIMARY' && data.assignments.some((x) => x.id !== assignment.id && x.customerId === assignment.customerId && x.portfolioId === assignment.portfolioId && x.role === 'BACKUP' && assignmentState(x) !== 'Ended');
  const [f, setF] = useState<TransferInput>({
    assignmentId: assignment.id, reason: '', notes: '', effectiveDate: todayStr(), newOwner: hasBackup ? 'NONE' : assignment.servedBy === 'DIRECT' ? 'PARTNER' : 'DIRECT', newPartnerId: null,
    handover: { openOrders: false, stockAtPartner: false, consignmentKits: false, pendingClaims: false, receivables: false }, portfolioName,
  });
  const candidates = candidatePartners(hospital, data.partners, config, data.territories).filter((p) => p.id !== assignment.partnerId);
  const allDone = Object.values(f.handover).every(Boolean);

  const submit = async () => {
    const r = await run(() => coverageService.requestTransfer(f, actor), (x) => (x.needsApproval ? 'Transfer sent for approval.' : 'Transfer applied.'));
    if (r) onClose();
  };

  return (
    <Modal open title="Transfer or remove" subtitle={`${hospital?.name ?? ''} · ${portfolioName} · now ${ownerName(assignment, data.partners, principal.name)} (${assignment.role === 'PRIMARY' ? 'primary' : 'backup'})`} onClose={onClose} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<ArrowRightLeft size={15} />} loading={pending} disabled={config.coverage.requireHandover && !allDone} onClick={submit}>Send for approval</Button></>}>
      <div className="g2-stack">
        {errors.length > 0 && <ErrorList errors={errors} />}
        <FormGrid>
          <Field label="Reason" required><Select value={f.reason} placeholder="Choose…" onChange={(v) => setF({ ...f, reason: v })} options={config.coverage.transferReasons.map((r) => ({ value: r, label: r }))} /></Field>
          <Field label="Effective date" required hint="Old owner serves until the day before."><Input type="date" min={todayStr()} value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} /></Field>
        </FormGrid>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Two missed surgeries in October; fill rate 82%" /></Field>
        <Field label="Who serves from that date?" required>
          <Segmented value={f.newOwner} onChange={(v) => setF({ ...f, newOwner: v as TransferInput['newOwner'], newPartnerId: null })}
            options={[
              ...(hasBackup ? [{ id: 'NONE', label: 'Backup takes over' }] : []),
              { id: 'PARTNER', label: 'Another partner' },
              ...(assignment.servedBy !== 'DIRECT' ? [{ id: 'DIRECT', label: 'Company direct' }] : []),
            ]} />
        </Field>
        {f.newOwner === 'PARTNER' && (
          <Field label="New partner" required>
            <SearchableSelect value={f.newPartnerId} placeholder="Choose partner…" onChange={(v) => setF({ ...f, newPartnerId: v })}
              options={candidates.map((p) => ({ value: p.id, label: p.name, description: p.code }))} />
          </Field>
        )}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Handover checklist{config.coverage.requireHandover && ' (all required)'}</div>
          <div className="g2-stack" style={{ gap: 6 }}>
            {HANDOVER.map((h) => (
              <Checkbox key={h.key} checked={f.handover[h.key]} onChange={(v) => setF({ ...f, handover: { ...f.handover, [h.key]: v } })}
                label={<span><strong>{h.label}</strong> <span className="g2-muted g2-small">— {h.hint}</span></span>} />
            ))}
          </div>
        </div>
        <Alert tone="info">After approval ({config.approvalWorkflows.find((w) => w.category === 'CUSTOMER_TRANSFER')?.levels.join(' → ') || 'not required'}), the change applies on the effective date with no gap in supply. History is kept.</Alert>
      </div>
    </Modal>
  );
};
