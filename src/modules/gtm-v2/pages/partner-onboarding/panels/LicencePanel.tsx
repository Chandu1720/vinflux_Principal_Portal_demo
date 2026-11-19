import React, { useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { Alert, Button, Field, FormGrid, Input, Modal, StatusBadge } from '../../../components/ui';
import { LicenceBadge } from '../../../components/domain/HealthBadges';
import { partnerOpsService } from '../../../services';
import { useAction } from '../../../hooks/useAction';
import { useGtmAuth } from '../../../hooks/useGtmAuth';
import { licenceItems, today } from '../../../utils/health';
import { formatBytes, formatDate } from '../../../utils/format';
import type { KycDocument, Partner } from '../../../types';
import type { GtmBundle } from '../stepProps';

/** KYC documents with licence validity and renewal. */
export const LicencePanel: React.FC<{ partner: Partner; data: GtmBundle }> = ({ partner, data }) => {
  const { actor } = useGtmAuth();
  const { run, pending, errors, setErrors } = useAction();
  const config = data.config!;
  const items = licenceItems(partner, config);
  const [renew, setRenew] = useState<{ doc: KycDocument; file: File | null; no: string; until: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canRenew = partner.status === 'Active' || partner.status === 'Suspended';

  if (partner.kycDocuments.length === 0) return <div className="g2-muted">No KYC documents uploaded.</div>;

  const submit = async () => {
    if (!renew) return;
    if (!renew.file) { setErrors(['Attach the renewed licence.']); return; }
    const f = renew.file;
    const r = await run(() => partnerOpsService.renewDocument(partner.id, renew.doc.docTypeId, { fileName: f.name, fileSize: f.size }, renew.no, renew.until, actor), 'Renewed licence uploaded — sent to Compliance for verification.');
    if (r) setRenew(null);
  };

  return (
    <div className="g2-stack">
      {items.some((i) => i.state === 'expired') && <Alert tone="error">A licence has expired.{config.compliance.blockOnExpiredLicence ? ' The partner is blocked from trading until a renewed licence is uploaded and verified.' : ''}</Alert>}
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>Document</th><th>File</th><th>Licence no.</th><th>Valid until</th><th>Verification</th><th className="actions" /></tr></thead>
        <tbody>{partner.kycDocuments.map((d) => {
          const req = config.kycDocuments.find((k) => k.id === d.docTypeId);
          const item = items.find((i) => i.doc.id === d.id) ?? null;
          return (
            <tr key={d.id}>
              <td className="g2-strong">{req?.name ?? d.docTypeId}{d.remarks && <div className="g2-cell-sub">{d.remarks}</div>}</td>
              <td>{d.fileName}<div className="g2-cell-sub">{formatBytes(d.fileSize)} · {formatDate(d.uploadedAt)}</div></td>
              <td className="g2-mono">{d.documentNo || '—'}</td>
              <td>{req?.tracksExpiry ? <>
                {formatDate(d.validUntil)}
                {item?.renewalPending && <div className="g2-cell-sub">Current copy: {formatDate((d as KycDocument & { replaces?: KycDocument }).replaces?.validUntil)}</div>}
                <div style={{ marginTop: 4 }}><LicenceBadge item={item} /></div>
              </> : <span className="g2-muted">No expiry</span>}</td>
              <td><StatusBadge status={d.status} /></td>
              <td className="actions">{req?.tracksExpiry && canRenew && d.status !== 'Under Review' && (
                <Button size="sm" icon={<RefreshCw size={13} />} onClick={() => { setErrors([]); setRenew({ doc: d, file: null, no: d.documentNo ?? '', until: '' }); }}>Renew</Button>
              )}</td>
            </tr>
          );
        })}</tbody>
      </table></div>

      {renew && (
        <Modal open title={`Renew ${config.kycDocuments.find((k) => k.id === renew.doc.docTypeId)?.name ?? 'licence'}`} subtitle={partner.name} onClose={() => setRenew(null)}
          footer={<><Button onClick={() => setRenew(null)}>Cancel</Button><Button variant="primary" loading={pending} onClick={submit}>Upload renewal</Button></>}>
          <div className="g2-stack">
            {errors.length > 0 && <Alert tone="error">{errors[0]}</Alert>}
            <Alert tone="info">Current copy valid until <strong>{formatDate(renew.doc.validUntil)}</strong>. The partner keeps trading on the current copy while Compliance verifies the renewal.</Alert>
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0] ?? null; setRenew((r) => (r ? { ...r, file: f } : r)); e.target.value = ''; }} />
            <Field label="Renewed licence" required>
              <div className="g2-row"><Button icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>{renew.file ? 'Replace file' : 'Choose file'}</Button>{renew.file && <span className="g2-small">{renew.file.name} · {formatBytes(renew.file.size)}</span>}</div>
            </Field>
            <FormGrid>
              <Field label="Licence no."><Input value={renew.no} onChange={(e) => setRenew({ ...renew, no: e.target.value })} /></Field>
              <Field label="Valid until" required><Input type="date" min={today()} value={renew.until} onChange={(e) => setRenew({ ...renew, until: e.target.value })} /></Field>
            </FormGrid>
          </div>
        </Modal>
      )}
    </div>
  );
};
