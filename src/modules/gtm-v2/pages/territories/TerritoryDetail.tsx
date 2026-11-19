import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Power, Trash2 } from 'lucide-react';
import type { TerritoryNode } from '../../types';
import { territoryService } from '../../services';
import type { TerritoryDependencies } from '../../services';
import { Button, Card, EmptyState, LoadingState, StatusBadge } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export const TerritoryDetail: React.FC<{
  node: TerritoryNode | null;
  canEdit: boolean;
  onAddChild: (id: string) => void;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  refreshKey: string;
}> = ({ node, canEdit, onAddChild, onEdit, onToggle, onDelete, refreshKey }) => {
  const [deps, setDeps] = useState<TerritoryDependencies | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node) return;
    let alive = true;
    setLoading(true);
    territoryService.dependencies(node.id).then((d) => { if (alive) setDeps(d); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [node, refreshKey]);

  if (!node) return <Card title="Territory details"><EmptyState title="Select a territory" description="Choose a node in the hierarchy to view its details, dependencies and actions." /></Card>;

  const list = (label: string, items: string[]) => (
    <div style={{ marginBottom: 10 }}>
      <div className="g2-label" style={{ marginBottom: 4 }}>{label} <span className="g2-muted">({items.length})</span></div>
      {items.length ? <div className="g2-row" style={{ gap: 4 }}>{items.map((i) => <span key={i} className="g2-chip neutral">{i}</span>)}</div> : <span className="g2-small g2-muted">None</span>}
    </div>
  );

  return (
    <Card title={node.name} subtitle={node.path.join(' › ')} actions={<StatusBadge status={node.status} />}>
      <dl className="g2-dl">
        <dt>Code</dt><dd className="g2-mono">{node.code}</dd>
        <dt>Level</dt><dd>{node.levelLabel} <span className="g2-muted">(depth {node.depth + 1})</span></dd>
        <dt>Direct children</dt><dd>{node.children.length}</dd>
        <dt>Description</dt><dd>{node.description || <span className="g2-muted">—</span>}</dd>
        <dt>Last updated</dt><dd>{formatDateTime(node.updatedAt)} · {node.updatedBy}</dd>
      </dl>
      <div className="g2-divider" />
      <div className="g2-card-title" style={{ fontSize: 13.5, marginBottom: 10 }}>Dependencies</div>
      {loading && !deps ? <LoadingState /> : deps && (
        <>
          {list('Zones', deps.zones)}
          {list('Sales policies (direct)', deps.flows)}
          {list('Partners', deps.partners)}
          <div className="g2-small g2-muted">Territory commercial term records: {deps.terms}</div>
        </>
      )}
      {canEdit && (
        <>
          <div className="g2-divider" />
          <div className="g2-row">
            <Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => onAddChild(node.id)} disabled={node.status === 'Inactive'}>Add child</Button>
            <Button size="sm" icon={<Edit3 size={14} />} onClick={() => onEdit(node.id)}>Edit</Button>
            <Button size="sm" icon={<Power size={14} />} onClick={() => onToggle(node.id)}>{node.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onDelete(node.id)} style={{ color: 'var(--g2-red)' }}>Delete</Button>
          </div>
        </>
      )}
    </Card>
  );
};
