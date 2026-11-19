import React, { useState } from 'react';
import { ArrowRightLeft, Plus, Timer } from 'lucide-react';
import { Alert, Badge, Button, Field, Modal, Textarea } from '../../components/ui';
import { coverageService } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { METRIC_ROWS, assignmentState, covers, metricsOf, ownerName, scoreOf, scoreStatus, scoreTone } from '../../utils/coverage';
import { formatDate } from '../../utils/format';
import type { CustomerAssignment } from '../../types';
import type { GtmBundle } from '../partner-onboarding/stepProps';

/**
 * One hospital × portfolio: current owner(s) side by side, performance steps, history, actions.
 */
export const CoverageCellDrawer: React.FC<{
  data: GtmBundle; customerId: string; portfolioId: string | null; portfolioName: string;
  onAssign: (role: 'PRIMARY' | 'BACKUP') => void; onTransfer: (a: CustomerAssignment) => void; onClose: () => void;
}> = ({ data, customerId, portfolioId, portfolioName, onAssign, onTransfer, onClose }) => {
  const { actor, principal, can } = useGtmAuth();
  const { run, pending } = useAction();
  const [improve, setImprove] = useState<CustomerAssignment | null>(null);
  const [note, setNote] = useState('');
  const config = data.config!;
  const hospital = data.partners.find((p) => p.id === customerId);
  const scoped = data.assignments.filter((a) => a.customerId === customerId && covers(a, portfolioId));
  const live = scoped.filter((a) => assignmentState(a) !== 'Ended').sort((a, b) => (a.role === b.role ? 0 : a.role === 'PRIMARY' ? -1 : 1));
  const ended = scoped.filter((a) => assignmentState(a) === 'Ended').sort((a, b) => (b.effectiveTo ?? '').localeCompare(a.effectiveTo ?? ''));
  const compare = [...live, ...ended.slice(0, 1)];
  const name = (a: CustomerAssignment) => ownerName(a, data.partners, principal.name);
  const transferOf = (a: CustomerAssignment) => data.transfers.find((t) => t.id === a.pendingTransferId);

  return (
    <Modal open size="xl" title={`${hospital?.name ?? 'Hospital'} · ${portfolioName}`} subtitle={hospital?.institution?.hospitalGroup ? `Group: ${hospital.institution.hospitalGroup}` : hospital?.address.city} onClose={onClose}>
      <div className="g2-stack">
        {live.length === 0 && <Alert tone="warn">Nobody serves this hospital for {portfolioName} — this is white space.</Alert>}
        <div className="g2-row">
          {!live.some((a) => a.role === 'PRIMARY') && <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => onAssign('PRIMARY')}>Assign primary</Button>}
          {live.some((a) => a.role === 'PRIMARY') && config.coverage.allowBackup && !live.some((a) => a.role === 'BACKUP') && <Button size="sm" icon={<Plus size={14} />} onClick={() => onAssign('BACKUP')}>Add backup</Button>}
        </div>

        {compare.length > 0 && (
          <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
            <table className="g2-table">
              <thead><tr><th>Scorecard</th>{compare.map((a) => (
                <th key={a.id}>
                  <div className="g2-cell-main">{name(a)}</div>
                  <div className="g2-row" style={{ gap: 4, marginTop: 2 }}>
                    <Badge tone={a.role === 'PRIMARY' ? 'purple' : 'slate'}>{a.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge>
                    {assignmentState(a) === 'Ended' && <Badge tone="slate">Previous</Badge>}
                    {assignmentState(a) === 'Scheduled' && <Badge tone="cyan">From {formatDate(a.effectiveFrom)}</Badge>}
                  </div>
                </th>
              ))}</tr></thead>
              <tbody>
                {METRIC_ROWS.map((r) => {
                  const vals = compare.map((a) => metricsOf(a)[r.key]);
                  const best = r.better === 'high' ? Math.max(...vals) : Math.min(...vals);
                  return (
                    <tr key={r.key}><td>{r.label}</td>{compare.map((a, i) => (
                      <td key={a.id} className={vals.length > 1 && vals[i] === best ? 'g2-strong' : ''} style={vals.length > 1 && vals[i] === best ? { color: 'var(--g2-green)' } : undefined}>{r.fmt(vals[i])}</td>
                    ))}</tr>
                  );
                })}
                <tr><td className="g2-strong">Score</td>{compare.map((a) => {
                  const sc = scoreOf(metricsOf(a)); const st = scoreStatus(sc, config.coverage);
                  return <td key={a.id}><span className="g2-strong" style={{ fontSize: 16 }}>{sc}</span> <Badge tone={scoreTone(st)} dot>{st}</Badge></td>;
                })}</tr>
                <tr><td>Since</td>{compare.map((a) => <td key={a.id}>{formatDate(a.effectiveFrom)}{a.effectiveTo ? ` – ${formatDate(a.effectiveTo)}` : ''}</td>)}</tr>
                {can.manageConfig && (
                  <tr><td /> {compare.map((a) => {
                    if (assignmentState(a) === 'Ended') return <td key={a.id} />;
                    const t = transferOf(a);
                    const st = scoreStatus(scoreOf(metricsOf(a)), config.coverage);
                    return (
                      <td key={a.id}>
                        <div className="g2-stack" style={{ gap: 6 }}>
                          {t ? <Badge tone="amber">Transfer pending approval · {formatDate(t.effectiveDate)}</Badge> : <Button size="sm" icon={<ArrowRightLeft size={13} />} onClick={() => onTransfer(a)}>Transfer / remove</Button>}
                          {a.servedBy === 'PARTNER' && !a.improvement && st !== 'Good' && <Button size="sm" variant="soft" icon={<Timer size={13} />} onClick={() => { setImprove(a); setNote(''); }}>Start improvement period</Button>}
                        </div>
                      </td>
                    );
                  })}</tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="g2-small g2-muted">Sample figures until secondary sales are connected. Score weights: target 30%, fill rate 25%, delivery 15%, complaints 15%, payment 15%. “On watch” below {config.coverage.watchBelow}, improvement recommended below {config.coverage.improveBelow}.</div>

        {live.filter((a) => a.improvement).map((a) => (
          <Alert key={a.id} tone="warn" icon={<Timer size={16} />}>
            <strong>{name(a)}</strong> is in an improvement period until {formatDate(a.improvement!.until)}: {a.improvement!.note}
            {' '}<Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => coverageService.endImprovement(a.id, actor), 'Improvement period closed.')}>Close — improved</Button>
          </Alert>
        ))}

        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>History</div>
          {ended.length === 0 ? <div className="g2-muted g2-small">No earlier owners.</div> : ended.map((a) => (
            <div key={a.id} className="g2-list-item g2-small">
              <div style={{ flex: 1 }}><span className="g2-strong">{name(a)}</span> <span className="g2-muted">({a.role === 'PRIMARY' ? 'primary' : 'backup'}) {formatDate(a.effectiveFrom)} – {formatDate(a.effectiveTo)}</span></div>
              <span>{a.endReason}{a.endNotes ? ` — ${a.endNotes}` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {improve && (
        <Modal open title="Start improvement period" subtitle={`${name(improve)} · ${config.coverage.improvementDays} days`} onClose={() => setImprove(null)}
          footer={<><Button onClick={() => setImprove(null)}>Cancel</Button><Button variant="primary" loading={pending} disabled={!note.trim()} onClick={async () => { const r = await run(() => coverageService.startImprovement(improve.id, note, actor), 'Improvement period started.'); if (r) setImprove(null); }}>Start</Button></>}>
          <div className="g2-stack">
            <Alert tone="info">Standard practice before removing a partner: a written warning and a fixed period to improve. If the score doesn’t recover, use Transfer / remove.</Alert>
            <Field label="What must improve?" required><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fill rate above 95%, delivery within 2 days, no missed surgeries" /></Field>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
