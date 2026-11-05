import React, { useState } from 'react';
import { Ban, CheckCheck, Mail, Send, UserPlus } from 'lucide-react';
import { Alert, Button, Field, FormGrid, IconButton, Input, Modal, Select, StatusBadge } from '../../../components/ui';
import { partnerOpsService } from '../../../services';
import type { InviteInput } from '../../../services';
import { useAction } from '../../../hooks/useAction';
import { useGtmAuth } from '../../../hooks/useGtmAuth';
import { portalEnabledFor, portalStatus } from '../../../utils/health';
import { formatDate, formatDateTime } from '../../../utils/format';
import type { Partner, PortalRole } from '../../../types';
import type { GtmBundle } from '../stepProps';

const ROLES: { value: PortalRole; label: string; hint: string }[] = [
  { value: 'Owner', label: 'Owner', hint: 'Everything, including adding users' },
  { value: 'Ordering', label: 'Ordering', hint: 'Place and track orders' },
  { value: 'Accounts', label: 'Accounts', hint: 'Invoices, payments, statements' },
  { value: 'Viewer', label: 'Viewer', hint: 'Read only' },
];

/** Partner portal users: invite, resend, revoke. Acceptance is simulated in the demo. */
export const PortalPanel: React.FC<{ partner: Partner; data: GtmBundle }> = ({ partner, data }) => {
  const { actor } = useGtmAuth();
  const { run, pending, errors, setErrors } = useAction();
  const [form, setForm] = useState<InviteInput | null>(null);
  const config = data.config!;
  const users = partner.portalUsers ?? [];

  if (!portalEnabledFor(partner, config)) return <Alert tone="info">Portal access isn’t enabled for this partner type. Turn it on in Configuration → Partner Portal.</Alert>;
  const canInvite = partner.status === 'Active' || partner.status === 'Approval Pending';

  const submit = async () => {
    if (!form) return;
    const r = await run(() => partnerOpsService.invite(partner.id, form, actor), (u) => `Invite sent to ${u.email}.`);
    if (r) setForm(null);
  };

  return (
    <div className="g2-stack">
      {partner.status === 'Suspended' && <Alert tone="warn">Partner is suspended — portal sign-in is paused for all users until it’s reactivated.</Alert>}
      <div className="g2-row">
        <span className="g2-muted g2-small">Invites are valid for {config.portal.inviteValidityDays} days.{config.portal.autoInviteOnActivation ? ' The contact person is invited automatically when the partner is activated.' : ''}</span>
        <span className="g2-spacer" />
        <Button variant="primary" size="sm" icon={<UserPlus size={14} />} disabled={!canInvite}
          onClick={() => { setErrors([]); setForm({ name: users.length ? '' : partner.contactPerson, email: users.length ? '' : partner.email, phone: users.length ? '' : partner.phone, role: users.length ? 'Ordering' : 'Owner' }); }}>
          Invite user</Button>
      </div>
      {users.length === 0 ? <div className="g2-muted">No portal users yet.</div> : (
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Invited</th><th className="actions" /></tr></thead>
          <tbody>{users.map((u) => {
            const st = portalStatus(u);
            return (
              <tr key={u.id}>
                <td><div className="g2-cell-main">{u.name}</div><div className="g2-cell-sub">{u.email}</div></td>
                <td>{u.role}</td>
                <td><StatusBadge status={st} tone={st === 'Invited' ? 'amber' : st === 'Revoked' ? 'red' : undefined} />
                  <div className="g2-cell-sub">{st === 'Active' ? `Joined ${formatDate(u.acceptedAt)}` : st === 'Invited' ? `Expires ${formatDate(u.expiresAt)}` : st === 'Expired' ? `Expired ${formatDate(u.expiresAt)}` : ''}</div></td>
                <td>{formatDateTime(u.lastSentAt)}<div className="g2-cell-sub">by {u.invitedBy}</div></td>
                <td className="actions">
                  {(st === 'Invited' || st === 'Expired') && <IconButton label="Resend invite" onClick={() => run(() => partnerOpsService.resend(partner.id, u.id, actor), `Invite resent to ${u.email}.`)}><Send size={15} /></IconButton>}
                  {st === 'Invited' && <IconButton label="Simulate acceptance (demo)" onClick={() => run(() => partnerOpsService.simulateAccept(partner.id, u.id), `${u.name} joined the portal.`)}><CheckCheck size={15} /></IconButton>}
                  {st !== 'Revoked' && <IconButton label="Revoke access" onClick={() => run(() => partnerOpsService.revoke(partner.id, u.id, actor), `Access revoked for ${u.email}.`)}><Ban size={15} /></IconButton>}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}

      {form && (
        <Modal open title="Invite portal user" subtitle={partner.name} onClose={() => setForm(null)}
          footer={<><Button onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" icon={<Mail size={14} />} loading={pending} onClick={submit}>Send invite</Button></>}>
          <div className="g2-stack">
            {errors.length > 0 && <Alert tone="error">{errors[0]}</Alert>}
            <FormGrid>
              <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Mobile"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Role" required hint={ROLES.find((r) => r.value === form.role)?.hint}>
                <Select value={form.role} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} onChange={(v) => setForm({ ...form, role: v as PortalRole })} />
              </Field>
            </FormGrid>
          </div>
        </Modal>
      )}
    </div>
  );
};
