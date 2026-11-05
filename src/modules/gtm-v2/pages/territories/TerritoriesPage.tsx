import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit3, Lock, Plus, Power } from 'lucide-react';
import { useConfig, useTerritories } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { territoryService } from '../../services';
import type { TerritoryInput } from '../../services';
import type { Territory, TerritoryNode } from '../../types';
import { buildTerritoryTree, flattenTree, getAncestorIds, getDescendantIds } from '../../utils/territory';
import { Alert, Button, Card, ConfirmDialog, EmptyState, ErrorState, Highlight, IconButton, LoadingState, PageHeader, SearchInput, Select } from '../../components/ui';
import { TerritoryFormModal } from './TerritoryFormModal';
import { TerritoryDetail } from './TerritoryDetail';

type Confirm = { kind: 'toggle' | 'delete'; territory: Territory } | null;

const TerritoriesPage: React.FC = () => {
  const { data: territories, loading, error, refetch } = useTerritories();
  const { data: config } = useConfig();
  const { actor, can } = useGtmAuth();
  const action = useAction();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [level, setLevel] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: Territory | null; parentId: string | null }>({ open: false, editing: null, parentId: null });
  const [confirm, setConfirm] = useState<Confirm>(null);

  const items = useMemo(() => territories ?? [], [territories]);
  const labels = useMemo(() => config?.territoryRules.levelLabels ?? [], [config]);
  const tree = useMemo(() => buildTerritoryTree(items, labels), [items, labels]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const maxDepth = flat.reduce((m, n) => Math.max(m, n.depth), 0);

  // initial expansion: first two levels
  useEffect(() => {
    if (items.length && expanded.size === 0) setExpanded(new Set(flat.filter((n) => n.depth < 2).map((n) => n.id)));
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?focus=<id>
  const focus = params.get('focus');
  useEffect(() => {
    if (!focus || !items.length) return;
    if (items.some((t) => t.id === focus)) {
      setSelectedId(focus);
      setExpanded((s) => new Set([...s, ...getAncestorIds(focus, items)]));
    }
    params.delete('focus');
    setParams(params, { replace: true });
  }, [focus, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql && !status && level === '') return null;
    const hit = new Set<string>();
    flat.forEach((n) => {
      const ok = (!ql || n.name.toLowerCase().includes(ql) || n.code.toLowerCase().includes(ql))
        && (!status || n.status === status) && (level === '' || n.depth === Number(level));
      if (ok) { hit.add(n.id); getAncestorIds(n.id, items).forEach((a) => hit.add(a)); }
    });
    return hit;
  }, [q, status, level, flat, items]);
  const directHits = matches ? flat.filter((n) => matches.has(n.id) && (!q.trim() || n.name.toLowerCase().includes(q.toLowerCase()) || n.code.toLowerCase().includes(q.toLowerCase())) && (!status || n.status === status) && (level === '' || n.depth === Number(level))).length : flat.length;

  const selected = flat.find((n) => n.id === selectedId) ?? null;

  const submit = async (input: TerritoryInput) => {
    const r = await action.run(
      () => (form.editing ? territoryService.update(form.editing.id, input, actor) : territoryService.create(input, actor)),
      form.editing ? 'Territory updated.' : 'Territory created.',
    );
    if (r) {
      setForm({ open: false, editing: null, parentId: null });
      setSelectedId(r.id);
      setExpanded((s) => new Set([...s, ...getAncestorIds(r.id, [...items.filter((t) => t.id !== r.id), r])]));
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    const t = confirm.territory;
    if (confirm.kind === 'toggle') {
      const next = t.status === 'Active' ? 'Inactive' : 'Active';
      await action.run(() => territoryService.setStatus(t.id, next, actor), (n) => next === 'Inactive' ? `${n} territor${n === 1 ? 'y' : 'ies'} deactivated.` : 'Territory activated.');
    } else {
      const ok = await action.run(() => territoryService.remove(t.id), 'Territory deleted.');
      if (ok && selectedId === t.id) setSelectedId(t.parentId);
    }
    setConfirm(null);
  };

  const openEdit = (id: string) => { const t = items.find((x) => x.id === id); if (t) { action.setErrors([]); setForm({ open: true, editing: t, parentId: t.parentId }); } };
  const openAdd = (parentId: string | null) => { action.setErrors([]); setForm({ open: true, editing: null, parentId }); };
  const askToggle = (id: string) => { const t = items.find((x) => x.id === id); if (t) setConfirm({ kind: 'toggle', territory: t }); };
  const askDelete = (id: string) => { const t = items.find((x) => x.id === id); if (t) setConfirm({ kind: 'delete', territory: t }); };

  const renderNode = (n: TerritoryNode): React.ReactNode => {
    if (matches && !matches.has(n.id)) return null;
    const open = matches ? true : expanded.has(n.id);
    return (
      <div key={n.id}>
        <div className={`g2-tree-row ${selectedId === n.id ? 'selected' : ''}`} style={{ paddingLeft: 6 + n.depth * 22 }} onClick={() => setSelectedId(n.id)}>
          {n.children.length ? (
            <button type="button" className="g2-tree-toggle" aria-label={open ? 'Collapse' : 'Expand'} onClick={(e) => { e.stopPropagation(); setExpanded((s) => { const x = new Set(s); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; }); }}>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: 22, flexShrink: 0 }} />}
          <span className={`g2-tree-name ${n.status === 'Inactive' ? 'inactive' : ''}`}><Highlight text={n.name} query={q} /></span>
          <span className="g2-muted g2-small g2-mono"><Highlight text={n.code} query={q} /></span>
          <span className="g2-tree-level">{n.levelLabel}</span>
          {n.children.length > 0 && <span className="g2-small g2-muted">{getDescendantIds(n.id, items).length}</span>}
          {can.manageConfig && (
            <span className="g2-tree-actions" onClick={(e) => e.stopPropagation()}>
              <IconButton label="Add child" onClick={() => openAdd(n.id)} disabled={n.status === 'Inactive'}><Plus size={14} /></IconButton>
              <IconButton label="Edit" onClick={() => openEdit(n.id)}><Edit3 size={14} /></IconButton>
              <IconButton label={n.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => askToggle(n.id)}><Power size={14} /></IconButton>
            </span>
          )}
        </div>
        {open && n.children.map(renderNode)}
      </div>
    );
  };

  if (loading && !territories) return <LoadingState label="Loading territories…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const levelOptions = Array.from({ length: maxDepth + 1 }, (_, d) => ({ value: String(d), label: labels.find((l) => l.depth === d)?.label ?? `Level ${d + 1}` }));
  const descCount = confirm ? getDescendantIds(confirm.territory.id, items).filter((id) => items.find((t) => t.id === id)?.status === 'Active').length : 0;

  return (
    <div className="g2-stack">
      <PageHeader
        title="Territory Management"
        description="Configuration-driven territory hierarchy with unlimited levels. Level labels come from Configuration › Territory Rules."
        actions={can.manageConfig ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => openAdd(null)}>Add root territory</Button> : <span className="g2-row g2-small g2-muted"><Lock size={13} /> Read-only (config permission required)</span>}
      />
      <div className="g2-grid g2-grid-4">
        <div className="g2-card g2-kpi"><div><div className="g2-kpi-label">Territories</div><div className="g2-kpi-value">{items.length}</div></div></div>
        <div className="g2-card g2-kpi"><div><div className="g2-kpi-label">Active</div><div className="g2-kpi-value">{items.filter((t) => t.status === 'Active').length}</div></div></div>
        <div className="g2-card g2-kpi"><div><div className="g2-kpi-label">Hierarchy depth</div><div className="g2-kpi-value">{items.length ? maxDepth + 1 : 0}</div></div></div>
        <div className="g2-card g2-kpi"><div><div className="g2-kpi-label">Root territories</div><div className="g2-kpi-value">{tree.length}</div></div></div>
      </div>

      <div className="g2-grid g2-grid-main" style={{ alignItems: 'start' }}>
        <Card
          title="Territory hierarchy"
          subtitle={matches ? `${directHits} matching territories` : `${items.length} territories`}
          actions={<>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set(flat.map((n) => n.id)))}>Expand all</Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>Collapse all</Button>
          </>}
        >
          <div className="g2-row" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}><SearchInput value={q} onChange={setQ} placeholder="Search by name or code…" /></div>
            <Select style={{ width: 150 }} value={status} onChange={setStatus} placeholder="All statuses" options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} aria-label="Status filter" />
            <Select style={{ width: 150 }} value={level} onChange={setLevel} placeholder="All levels" options={levelOptions} aria-label="Level filter" />
          </div>
          {items.length === 0 ? (
            <EmptyState title="No territories yet" description="Start by creating a root territory such as a country." action={can.manageConfig && <Button variant="primary" onClick={() => openAdd(null)}>Add root territory</Button>} />
          ) : (
            <div className="g2-tree" style={{ maxHeight: 620, overflowY: 'auto' }}>
              {tree.map(renderNode)}
              {matches && directHits === 0 && <EmptyState title="No matching territories" description="Adjust the search or filters." />}
            </div>
          )}
        </Card>

        <TerritoryDetail
          node={selected}
          canEdit={can.manageConfig}
          onAddChild={(id) => openAdd(id)}
          onEdit={openEdit}
          onToggle={askToggle}
          onDelete={askDelete}
          refreshKey={items.map((t) => t.updatedAt).join()}
        />
      </div>

      {config && (
        <TerritoryFormModal
          open={form.open}
          editing={form.editing}
          defaultParentId={form.parentId}
          territories={items}
          rules={config.territoryRules}
          pending={action.pending}
          serverErrors={action.errors}
          onClose={() => setForm({ open: false, editing: null, parentId: null })}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        loading={action.pending}
        tone={confirm?.kind === 'delete' || confirm?.territory.status === 'Active' ? 'danger' : 'primary'}
        title={confirm?.kind === 'delete' ? `Delete "${confirm.territory.name}"?` : confirm?.territory.status === 'Active' ? `Deactivate "${confirm?.territory.name}"?` : `Activate "${confirm?.territory.name}"?`}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : confirm?.territory.status === 'Active' ? 'Deactivate' : 'Activate'}
        message={confirm?.kind === 'delete'
          ? <>Deletion is only allowed when the territory has no children and is not referenced by zones, sales policies, partners or commercial terms. Otherwise, deactivate it instead.</>
          : confirm?.territory.status === 'Active'
            ? <>
              This will also deactivate <strong>{descCount}</strong> active descendant territor{descCount === 1 ? 'y' : 'ies'}.
              Existing partner relationships are not modified, but inactive territories cannot be selected for new assignments.
              {descCount > 0 && <div style={{ marginTop: 8 }}><Alert tone="warn">Cascade deactivation applies to the entire subtree.</Alert></div>}
            </>
            : <>The territory becomes available for new zones, sales policies and partner assignments. Its parent must be active.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={doConfirm}
      />
    </div>
  );
};

export default TerritoriesPage;
