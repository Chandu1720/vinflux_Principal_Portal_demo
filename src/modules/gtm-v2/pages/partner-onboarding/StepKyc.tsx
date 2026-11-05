import React, { useRef, useState } from 'react';
import { FileCheck2, FileText, Trash2, Upload } from 'lucide-react';
import { Alert, Badge, Button, IconButton, Input, Select, StatusBadge } from '../../components/ui';
import type { KycDocument, KycDocumentRequirement } from '../../types';
import { formatBytes, formatDateTime, todayISO, uid } from '../../utils/format';
import { useApp } from '../../../../context/AppContext.tsx';
import type { StepProps } from './stepProps';

/** Validates a file against the configured requirement (format + max size). */
const checkFile = (req: KycDocumentRequirement, file: File): string | null => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!req.allowedFormats.includes(ext)) return `${req.name}: .${ext || '?'} not allowed (allowed: ${req.allowedFormats.join(', ')}).`;
  if (file.size > req.maxSizeMb * 1048576) return `${req.name}: file exceeds ${req.maxSizeMb} MB.`;
  return null;
};

export const StepKyc: React.FC<StepProps> = ({ state, update, config, showErrors }) => {
  const { showToast } = useApp();
  const docs = state.input.kycDocuments;
  const reqs = config.kycDocuments.filter((k) => k.status === 'Active' || docs.some((d) => d.docTypeId === k.id));
  const typeId = state.input.partnerTypeId;
  const [dropType, setDropType] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<string>('');

  const setDocs = (fn: (d: KycDocument[]) => KycDocument[]) => update((s) => ({ ...s, input: { ...s.input, kycDocuments: fn(s.input.kycDocuments) } }));

  /**
   * INTEGRATION POINT: POST /partners/:id/kyc-documents (multipart/form-data).
   * The prototype stores file metadata only; the binary is not uploaded anywhere.
   */
  const attach = (docTypeId: string, file: File) => {
    const req = config.kycDocuments.find((k) => k.id === docTypeId);
    if (!req) return;
    const err = checkFile(req, file);
    if (err) { showToast(err, 'danger'); return; }
    const doc: KycDocument = { id: uid('doc'), docTypeId, fileName: file.name, fileSize: file.size, uploadedAt: new Date().toISOString(), status: 'Pending', remarks: '' };
    setDocs((list) => [...list.filter((d) => d.docTypeId !== docTypeId), doc]);
    showToast(`${req.name} attached.`, 'success');
  };

  const browse = (docTypeId: string) => { pendingType.current = docTypeId; fileRef.current?.click(); };

  const mandatory = reqs.filter((r) => r.mandatoryForPartnerTypeIds.includes(typeId));
  const missing = mandatory.filter((r) => !docs.some((d) => d.docTypeId === r.id && d.status !== 'Rejected'));

  return (
    <div className="g2-stack">
      <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && pendingType.current) attach(pendingType.current, f); e.target.value = ''; }} />
      {missing.length > 0 ? (
        <Alert tone="warn" icon={<FileText size={16} />}>
          {missing.length} mandatory document{missing.length > 1 ? 's' : ''} missing: {missing.map((m) => m.name).join(', ')}. You can continue, but the partner will be submitted as <strong>KYC Pending</strong> until they are uploaded.
        </Alert>
      ) : (
        <Alert tone="success" icon={<FileCheck2 size={16} />}>All mandatory documents for this partner type are attached. Verification is performed by the KYC approver after submission.</Alert>
      )}

      <div
        className={`g2-dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (!f) return; if (!dropType) { showToast('Select a document type first.', 'warning'); return; } attach(dropType, f); }}
        onClick={() => { if (!dropType) { showToast('Select a document type first.', 'warning'); return; } browse(dropType); }}
      >
        <Upload size={22} />
        <div style={{ marginTop: 6 }}><strong>Drop a file here or click to browse</strong></div>
        <div className="g2-small" style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ width: 280 }}>
            <Select value={dropType} placeholder="Document type…" options={reqs.map((r) => ({ value: r.id, label: r.name }))} onChange={setDropType} />
          </div>
        </div>
      </div>

      <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
        <table className="g2-table">
          <thead><tr><th>Document type</th><th>Requirement</th><th>File</th><th>Verification</th><th style={{ width: 230 }}>Licence no. / valid until</th><th style={{ width: 180 }}>Remarks</th><th className="actions" /></tr></thead>
          <tbody>
            {reqs.map((r) => {
              const d = docs.find((x) => x.docTypeId === r.id);
              const isMandatory = r.mandatoryForPartnerTypeIds.includes(typeId);
              return (
                <tr key={r.id}>
                  <td><div className="g2-cell-main">{r.name}</div><div className="g2-cell-sub">{r.allowedFormats.join(', ').toUpperCase()} · max {r.maxSizeMb} MB</div></td>
                  <td>{isMandatory ? <Badge tone="red">Mandatory</Badge> : <Badge tone="slate">Optional</Badge>}</td>
                  <td>{d ? <><div className="g2-strong g2-ellipsis" style={{ maxWidth: 220 }}>{d.fileName}</div><div className="g2-cell-sub">{formatBytes(d.fileSize)} · {formatDateTime(d.uploadedAt)}</div></> : <span className="g2-muted">Not uploaded</span>}</td>
                  <td>{d ? <StatusBadge status={d.status} /> : <span className="g2-muted">—</span>}</td>
                  <td>{d && r.tracksExpiry ? (
                    <div className="g2-stack" style={{ gap: 6 }}>
                      <Input value={d.documentNo ?? ''} placeholder="Licence no." onChange={(e) => setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, documentNo: e.target.value } : x)))} />
                      <Input type="date" min={todayISO()} value={d.validUntil ?? ''} invalid={showErrors && (!d.validUntil || d.validUntil < todayISO())}
                        onChange={(e) => setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, validUntil: e.target.value || null } : x)))} />
                    </div>
                  ) : r.tracksExpiry ? <span className="g2-muted g2-small">Expiry tracked</span> : <span className="g2-muted">—</span>}</td>
                  <td>{d ? <Input value={d.remarks} placeholder="Remarks" onChange={(e) => setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, remarks: e.target.value } : x)))} /> : null}</td>
                  <td className="actions">
                    <Button size="sm" icon={<Upload size={13} />} onClick={() => browse(r.id)}>{d ? 'Replace' : 'Upload'}</Button>
                    {d && <IconButton label="Remove" disabled={d.status === 'Verified'} onClick={() => setDocs((list) => list.filter((x) => x.id !== d.id))}><Trash2 size={15} /></IconButton>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="g2-hint" style={{ margin: 0 }}>Verification status is set by the compliance approver (KYC Verification workflow). Uploaders cannot self-verify.</p>
    </div>
  );
};
