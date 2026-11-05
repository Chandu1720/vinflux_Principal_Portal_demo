import React, { useMemo, useState } from 'react';
import { KeyRound, LogIn, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, FormSection, Input, KpiCard, Modal, MultiSelect, PageHeader, SearchInput, Select, Tabs, Textarea,
} from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { portalStatus } from '../gtm-v2/utils/health';
import { initialPrincipals } from '../../data/productMasterData.ts';
import type { PermAction } from '../../types/product.ts';
import {
  ACTION_LABEL, RESOURCES, blankUser, deleteRole, hasPerm, matrixOf, roles as listRoles, saveRole, saveUser, subscribeUsers, users as listUsers,
} from './userStore';
import type { AppUser, Role } from './userStore';

const ACTIONS: PermAction[] = ['view', 'edit', 'approve', 'configure'];
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

/** Small read-only grid: what a matrix allows. */
const MatrixView: React.FC<{ matrix: Role['matrix'] }> = ({ matrix }) => (
  <div className="g2-table-wrap"><table className="g2-table">
    <thead><tr><th>Area</th>{ACTIONS.map((a) => <th key={a} style={{ textAlign: 'center' }}>{ACTION_LABEL[a]}</th>)}</tr></thead>
    <tbody>{RESOURCES.map((r) => (
      <tr key={r.id}><td>{r.label}</td>{ACTIONS.map((a) => (
        <td key={a} style={{ textAlign: 'center' }}>{!r.actions.includes(a) ? <span className="g2-muted">·</span> : hasPerm(matrix, r.id, a) ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span className="g2-muted">—</span>}</td>
      ))}</tr>
    ))}</tbody>
  </table></div>
);

/* --------------------------------- User drawer --------------------------------- */

const UserDrawer: React.FC<{ user: AppUser; onClose: () => void; readOnly: boolean }> = ({ user, onClose, readOnly }) => {
  const { currentUser, warehouses, showToast } = useApp();
  const territories = useTerritories().data ?? [];
  const [u, setU] = useState<AppUser>(user);
  const [err, setErr] = useState<string | null>(null);
  const isNew = !user.id;
  const set = <K extends keyof AppUser>(k: K, v: AppUser[K]) => setU((x) => ({ ...x, [k]: v }));
  const effective = matrixOf(u);
  const allPrincipals = initialPrincipals.map((p) => ({ value: p.id, label: p.name, description: p.code }));
  const self = u.id === currentUser.id;
  const save = () => {
    const e = saveUser(u, { id: currentUser.id, name: currentUser.name });
    if (e) { setErr(e); return; }
    showToast(isNew ? `User ${u.name} added. An invitation email would be sent to ${u.email}.` : `User ${u.name} updated.`, 'success');
    onClose();
  };
  return (
    <Modal open size="lg" title={isNew ? 'Add user' : u.name} subtitle={isNew ? 'Staff user of the principal' : u.email} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button>{!readOnly && <Button variant="primary" onClick={save}>{isNew ? 'Add user' : 'Save changes'}</Button>}</>}>
      <div className="g2-stack">
        {err && <ErrorList errors={err.split(/(?<=\.) /)} />}
        <FormSection title="Details">
          <FormGrid>
            <Field label="Full name" required><Input value={u.name} disabled={readOnly} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Work email" required hint="Used to sign in (SSO later)"><Input value={u.email} disabled={readOnly} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Phone"><Input value={u.phone} disabled={readOnly} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Job title"><Input value={u.title} disabled={readOnly} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Status"><Select value={u.status} disabled={readOnly || self} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive — cannot sign in' }]} onChange={(v) => set('status', v as AppUser['status'])} /></Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Roles" description={self ? 'You can’t change your own roles — another administrator must do it.' : 'A user can hold several roles; permissions add up.'}>
          <div className="g2-grid g2-grid-2">
            {listRoles().filter((r) => r.kind === 'Staff').map((r) => (
              <div key={r.id} className="g2-card" style={{ padding: 10 }}>
                <Checkbox checked={u.roleIds.includes(r.id)} disabled={readOnly || self}
                  onChange={(v) => set('roleIds', v ? [...u.roleIds, r.id] : u.roleIds.filter((x) => x !== r.id))}
                  label={<span><strong>{r.name}</strong><br /><span className="g2-small g2-muted">{r.description}</span></span>} />
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection title="Data scope" description="Leave empty for all. Scope limits what the user sees — e.g. a regional head only sees partners and hospitals in their territories.">
          <FormGrid cols={3}>
            <Field label="Principals"><MultiSelect values={u.principalIds} disabled={readOnly} placeholder="All principals" options={allPrincipals} onChange={(v) => set('principalIds', v)} /></Field>
            <Field label="Territories" hint="Includes everything below"><MultiSelect values={u.territoryIds} disabled={readOnly} placeholder="All territories" options={territories.filter((t) => t.status === 'Active').map((t) => ({ value: t.id, label: t.name, description: t.code }))} onChange={(v) => set('territoryIds', v)} /></Field>
            <Field label="Warehouses"><MultiSelect values={u.warehouseIds} disabled={readOnly} placeholder="All warehouses" options={warehouses.map((w) => ({ value: w.id, label: w.code, description: w.name }))} onChange={(v) => set('warehouseIds', v)} /></Field>
          </FormGrid>
        </FormSection>
        <FormSection title="What this user can do" description="Combined from the selected roles.">
          <MatrixView matrix={effective} />
        </FormSection>
      </div>
    </Modal>
  );
};

/* --------------------------------- Role editor --------------------------------- */

const RoleEditor: React.FC<{ role: Role; readOnly: boolean; onDone: () => void }> = ({ role, readOnly, onDone }) => {
  const { currentUser, showToast } = useApp();
  const [r, setR] = useState<Role>(role);
  const [err, setErr] = useState<string | null>(null);
  const users = listUsers().filter((u) => u.roleIds.includes(role.id));
  const toggle = (res: typeof RESOURCES[number]['id'], a: PermAction, on: boolean) => setR((x) => {
    let list = new Set(x.matrix[res] ?? []);
    if (on) { list.add(a); list.add('view'); } else { list.delete(a); if (a === 'view') list = new Set(); }
    return { ...x, matrix: { ...x.matrix, [res]: ACTIONS.filter((k) => list.has(k)) } };
  });
  const save = () => {
    const e = saveRole(r, currentUser.name);
    if (e) { setErr(e); return; }
    showToast(`Role "${r.name}" saved. Users with this role get the change immediately.`, 'success');
    onDone();
  };
  const remove = () => { const e = deleteRole(r.id); if (e) setErr(e); else { showToast(`Role "${r.name}" deleted.`, 'warning'); onDone(); } };
  const ro = readOnly || r.kind === 'Partner';
  return (
    <Card title={<span className="g2-row">{r.name || 'New role'} {r.system && <Badge tone="purple">System</Badge>}{r.kind === 'Partner' && <Badge tone="blue">Partner portal</Badge>}</span>}
      subtitle={`${users.length} user(s)`}
      actions={!ro && <>
        {!r.system && r.id && <Button variant="danger" icon={<Trash2 size={14} />} onClick={remove}>Delete</Button>}
        <Button variant="primary" onClick={save}>Save role</Button>
      </>}>
      <div className="g2-stack">
        {err && <Alert tone="error">{err}</Alert>}
        {r.kind === 'Partner' && <Alert>Partner portal roles are managed per partner in Go-to-Market → Partners → Portal access (Owner, Ordering, Accounts, Viewer).</Alert>}
        <FormGrid>
          <Field label="Role name" required><Input value={r.name} disabled={ro || r.system} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={1} value={r.description} disabled={ro} onChange={(e) => setR({ ...r, description: e.target.value })} /></Field>
        </FormGrid>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Area</th>{ACTIONS.map((a) => <th key={a} style={{ textAlign: 'center' }}>{ACTION_LABEL[a]}</th>)}</tr></thead>
          <tbody>{RESOURCES.map((res) => (
            <tr key={res.id}>
              <td><div className="g2-strong">{res.label}</div><div className="g2-cell-sub">{res.hint}</div></td>
              {ACTIONS.map((a) => (
                <td key={a} style={{ textAlign: 'center' }}>
                  {res.actions.includes(a)
                    ? <input type="checkbox" aria-label={`${res.label} ${a}`} checked={hasPerm(r.matrix, res.id, a)} disabled={ro} onChange={(e) => toggle(res.id, a, e.target.checked)} />
                    : <span className="g2-muted">·</span>}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table></div>
        {users.length > 0 && <div className="g2-small g2-muted">Held by: {users.map((u) => u.name).join(', ')}</div>}
      </div>
    </Card>
  );
};

/* ----------------------------------- Page ----------------------------------- */

const UsersRolesPage: React.FC = () => {
  useSubscribe(subscribeUsers);
  const { currentUser, signInAs, warehouses } = useApp();
  const territories = useTerritories().data ?? [];
  const partners = usePartners().data ?? [];
  const [tab, setTab] = useState('users');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [roleId, setRoleId] = useState<string>('role-admin');
  const [newRole, setNewRole] = useState<Role | null>(null);
  const canUsers = !!currentUser.permissions.canManageUsers;
  const canRoles = !!currentUser.permissions.canConfigurePlatform;
  const users = listUsers();
  const roles = listRoles();
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const shown = users.filter((u) => [u.name, u.email, u.title, ...u.roleIds.map(roleName)].some((x) => x.toLowerCase().includes(q.toLowerCase())));
  const portalRows = useMemo(() => partners.flatMap((p) => (p.portalUsers ?? []).map((pu) => ({ p, pu }))), [partners]);
  const scopeText = (u: AppUser) => {
    const parts: string[] = [];
    if (u.territoryIds.length) parts.push(u.territoryIds.map((id) => territories.find((t) => t.id === id)?.name ?? id).join(', '));
    if (u.warehouseIds.length) parts.push(u.warehouseIds.map((id) => warehouses.find((w) => w.id === id)?.code ?? id).join(', '));
    if (u.principalIds.length) parts.push(`${u.principalIds.length} principal(s)`);
    return parts.length ? parts.join(' · ') : 'Everything';
  };
  const activeRole = newRole ?? roles.find((r) => r.id === roleId) ?? roles[0];

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Users & Roles" description="Who can sign in, what they can do (roles) and what they can see (scope). Approvals use these rights — a maker can’t approve their own work."
        actions={tab === 'users' && canUsers && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing(blankUser())}>Add user</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Active users" value={users.filter((u) => u.status === 'Active').length} icon={<Users size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${users.filter((u) => u.status !== 'Active').length} inactive`} />
        <KpiCard label="Roles" value={roles.filter((r) => r.kind === 'Staff').length} icon={<ShieldCheck size={22} />} color="#059669" bg="#ecfdf5" foot={`${roles.filter((r) => r.system).length} system`} />
        <KpiCard label="Scoped users" value={users.filter((u) => u.territoryIds.length || u.warehouseIds.length).length} icon={<KeyRound size={22} />} color="#2563eb" bg="#eff6ff" foot="limited by territory / warehouse" />
        <KpiCard label="Partner portal users" value={portalRows.length} icon={<UserCog size={22} />} color="#d97706" bg="#fffbeb" foot={`${portalRows.filter((x) => portalStatus(x.pu) === 'Active').length} active`} />
      </div>
      {!canUsers && <div style={{ marginBottom: 12 }}><Alert tone="warn">You can view users and roles but not change them.</Alert></div>}
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Users', count: users.length }, { id: 'roles', label: 'Roles & permissions', count: roles.length }, { id: 'portal', label: 'Partner portal users', count: portalRows.length }]} />
          <span className="g2-spacer" />
          {tab === 'users' && <SearchInput value={q} onChange={setQ} placeholder="Name, email, role…" />}
        </div>
        {tab === 'users' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>User</th><th>Roles</th><th>Scope</th><th>Status</th><th>Last active</th><th /></tr></thead>
            <tbody>{shown.map((u) => (
              <tr key={u.id}>
                <td><div className="g2-strong">{u.name}{u.id === currentUser.id && <> <Badge tone="purple">You</Badge></>}</div><div className="g2-cell-sub">{u.title} · {u.email}</div></td>
                <td>{u.roleIds.map((id) => <span key={id} className="g2-chip" style={{ marginRight: 4 }}>{roleName(id)}</span>)}</td>
                <td className="g2-small">{scopeText(u)}</td>
                <td><Badge tone={u.status === 'Active' ? 'green' : 'slate'} dot>{u.status}</Badge></td>
                <td className="g2-small g2-muted">{when(u.lastActiveAt)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Button size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(u)}>{canUsers ? 'Edit' : 'View'}</Button>{' '}
                  {u.id !== currentUser.id && u.status === 'Active' && <Button size="sm" icon={<LogIn size={13} />} onClick={() => signInAs(u.id)} title="Demo: switch to this user">Sign in as</Button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {tab === 'roles' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 16, padding: 16 }}>
            <div className="g2-stack" style={{ gap: 6 }}>
              {roles.map((r) => (
                <button key={r.id} type="button" className="g2-card" onClick={() => { setNewRole(null); setRoleId(r.id); }}
                  style={{ padding: 10, textAlign: 'left', cursor: 'pointer', borderColor: !newRole && activeRole.id === r.id ? 'var(--g2-primary)' : undefined }}>
                  <div className="g2-row" style={{ gap: 6 }}><strong style={{ fontSize: 13 }}>{r.name}</strong>{r.kind === 'Partner' && <Badge tone="blue">Portal</Badge>}</div>
                  <div className="g2-cell-sub">{users.filter((u) => u.roleIds.includes(r.id)).length} user(s)</div>
                </button>
              ))}
              {canRoles && <Button icon={<Plus size={14} />} onClick={() => setNewRole({ id: '', name: '', description: '', kind: 'Staff', matrix: { products: ['view'] } })}>New role</Button>}
            </div>
            <RoleEditor key={activeRole.id || 'new'} role={activeRole} readOnly={!canRoles} onDone={() => setNewRole(null)} />
          </div>
        )}
        {tab === 'portal' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th>User</th><th>Portal role</th><th>Status</th><th>Invited</th></tr></thead>
            <tbody>
              {portalRows.length === 0 && <tr><td colSpan={5} className="g2-muted">No portal users yet. Invite them from Go-to-Market → Partners → Portal access.</td></tr>}
              {portalRows.map(({ p, pu }) => {
                const s = portalStatus(pu);
                return (
                  <tr key={pu.id}>
                    <td className="g2-strong">{p.name}</td>
                    <td><div>{pu.name}</div><div className="g2-cell-sub">{pu.email}</div></td>
                    <td>{pu.role}</td>
                    <td><Badge tone={s === 'Active' ? 'green' : s === 'Invited' ? 'blue' : s === 'Expired' ? 'amber' : 'slate'} dot>{s}</Badge></td>
                    <td className="g2-small g2-muted">{when(pu.invitedAt)} by {pu.invitedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
      {editing && <UserDrawer user={editing} readOnly={!canUsers} onClose={() => setEditing(null)} />}
    </div>
  );
};
export default UsersRolesPage;
