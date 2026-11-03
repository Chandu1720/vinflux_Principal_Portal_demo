import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Power,
  AlertCircle
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { TerritoryNode } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

export const TerritoryManagementPage: React.FC = () => {
  const {
    territories,
    addTerritory,
    updateTerritory,
    deleteTerritory,
    toggleTerritoryStatus
  } = useGtmV2();

  // Search & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>(
    territories[0]?.id || 'terr-ind'
  );
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'terr-ind': true,
    'terr-ap': true,
    'terr-coastal-ap': true,
    'terr-vja': true,
    'terr-tel': true,
    'terr-kar': true
  });

  // Modal State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<TerritoryNode | null>(null);
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLevelLabel, setFormLevelLabel] = useState('Operational Division');
  const [formDescription, setFormDescription] = useState('');
  const [formLead, setFormLead] = useState('');
  const [formPinInput, setFormPinInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm Dialog
  const [deleteTarget, setDeleteTarget] = useState<TerritoryNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Selected Territory Object
  const selectedTerritory = useMemo(() => {
    return territories.find((t) => t.id === selectedTerritoryId) || territories[0];
  }, [territories, selectedTerritoryId]);

  // Child territories of currently selected territory
  const childTerritories = useMemo(() => {
    if (!selectedTerritory) return [];
    return territories.filter((t) => t.parentId === selectedTerritory.id);
  }, [territories, selectedTerritory]);

  // Build recursive tree
  const treeRoots = useMemo(() => {
    const map = new Map<string, TerritoryNode & { children: TerritoryNode[] }>();
    territories.forEach((t) => {
      map.set(t.id, { ...t, children: [] });
    });

    const roots: (TerritoryNode & { children: TerritoryNode[] })[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [territories]);

  // Open Create Drawer
  const handleOpenCreate = (parentId: string | null = null) => {
    setEditingTerritory(null);
    setFormParentId(parentId);
    setFormName('');
    setFormCode(`TERR-${Math.floor(100 + Math.random() * 900)}`);
    setFormLevelLabel('Sub-Territory / Area');
    setFormDescription('');
    setFormLead('Regional Commercial Executive');
    setFormPinInput('');
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (t: TerritoryNode) => {
    setEditingTerritory(t);
    setFormParentId(t.parentId);
    setFormName(t.name);
    setFormCode(t.code);
    setFormLevelLabel(t.levelLabel || `Level ${t.level}`);
    setFormDescription(t.description || '');
    setFormLead(t.leadPerson || '');
    setFormPinInput((t.pinCodes || []).join(', '));
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Submit Drawer Form
  const handleSaveTerritory = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Territory name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Territory code is required.');
      return;
    }

    const pinCodes = formPinInput
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 4);

    if (editingTerritory) {
      // Update
      const res = updateTerritory(editingTerritory.id, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        parentId: formParentId,
        levelLabel: formLevelLabel.trim(),
        description: formDescription.trim(),
        leadPerson: formLead.trim(),
        pinCodes
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
    } else {
      // Add
      const res = addTerritory({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        parentId: formParentId,
        levelLabel: formLevelLabel.trim(),
        description: formDescription.trim(),
        leadPerson: formLead.trim(),
        pinCodes
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      if (res.territory) {
        setSelectedTerritoryId(res.territory.id);
      }
    }

    setIsDrawerOpen(false);
  };

  // Delete Action
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const res = deleteTerritory(deleteTarget.id);
    if (!res.success) {
      setDeleteError(res.message);
      return;
    }
    if (selectedTerritoryId === deleteTarget.id) {
      setSelectedTerritoryId(territories[0]?.id || '');
    }
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    territories.forEach((t) => {
      all[t.id] = true;
    });
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: TerritoryNode & { children?: TerritoryNode[] }, depth = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = Boolean(expandedNodes[node.id]);
    const isSelected = selectedTerritoryId === node.id;

    // Search filter matching
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchSelf =
        node.name.toLowerCase().includes(q) ||
        node.code.toLowerCase().includes(q) ||
        node.levelLabel?.toLowerCase().includes(q);
      const matchChild = (node.children || []).some(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
      if (!matchSelf && !matchChild) return null;
    }

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${depth * 18 + 8}px`,
            paddingRight: '12px',
            paddingTop: '6px',
            paddingBottom: '6px',
            borderRadius: '6px',
            backgroundColor: isSelected ? '#F3E8FF' : 'transparent',
            borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'background-color 0.12s'
          }}
          onClick={() => setSelectedTerritoryId(node.id)}
        >
          {/* Caret */}
          <span
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                toggleExpand(node.id);
              }
            }}
            style={{
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '6px',
              color: '#64748B',
              cursor: hasChildren ? 'pointer' : 'default',
              flexShrink: 0
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span style={{ fontSize: '13px', color: '#CBD5E1' }}>•</span>
            )}
          </span>

          {/* Node Icon */}
          <MapPin
            size={15}
            style={{
              color: isSelected ? '#7C3AED' : '#94A3B8',
              marginRight: '8px',
              flexShrink: 0
            }}
          />

          {/* Name & Badges */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? '#5B21B6' : '#1E293B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {node.name}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontFamily: 'monospace',
                backgroundColor: '#F1F5F9',
                color: '#64748B',
                padding: '1px 5px',
                borderRadius: '4px'
              }}
            >
              {node.code}
            </span>
          </div>

          <span
            style={{
              fontSize: '10px',
              color: '#94A3B8',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              padding: '1px 5px',
              borderRadius: '4px'
            }}
          >
            L{node.level}
          </span>
        </div>

        {/* Recursive Children */}
        {hasChildren && isExpanded && (
          <div>
            {(node.children as any).map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* -------------------------------------------------------------------- */}
      {/* TOP ACTIONS & TITLE */}
      {/* -------------------------------------------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={22} style={{ color: '#7C3AED' }} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Territory Management
            </h2>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Dynamic N-level geographic hierarchy with unlimited parent-child nesting and circular validation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreate(selectedTerritory ? selectedTerritory.id : null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#7C3AED',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)'
          }}
        >
          <Plus size={16} />
          <span>Add Territory</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TWO PANEL LAYOUT: DYNAMIC HIERARCHY TREE + SELECTED DETAILS */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: '20px',
          minHeight: '680px',
          alignItems: 'stretch'
        }}
      >
        {/* LEFT PANEL: SEARCHABLE N-LEVEL HIERARCHY TREE */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Tree Search & Collapse Controls */}
          <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8'
                }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search territory name or code..."
                style={{
                  width: '100%',
                  height: '36px',
                  paddingLeft: '32px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11.5px' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>
                {territories.length} Configured Nodes
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={expandAll}
                  style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', padding: '0 4px', fontWeight: 600 }}
                >
                  Expand all
                </button>
                <span style={{ color: '#CBD5E1' }}>|</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 4px' }}
                >
                  Collapse all
                </button>
              </div>
            </div>
          </div>

          {/* Tree Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
            {treeRoots.map((root) => renderTreeNode(root, 0))}
          </div>
        </div>

        {/* RIGHT PANEL: SELECTED TERRITORY DETAILS & SUB-TREE MANAGEMENT */}
        {selectedTerritory ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header Details */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '14px',
                backgroundColor: '#FFFFFF'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                    {selectedTerritory.name}
                  </h3>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 700
                    }}
                  >
                    {selectedTerritory.code}
                  </span>
                  <StatusBadge status={selectedTerritory.status} size="sm" />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#F3E8FF',
                      color: '#7C3AED',
                      border: '1px solid #DDD6FE',
                      padding: '2px 8px',
                      borderRadius: '9999px'
                    }}
                  >
                    {selectedTerritory.levelLabel || `Hierarchy Level ${selectedTerritory.level}`}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  {selectedTerritory.description || 'Enterprise healthcare and surgical device distribution jurisdiction.'}
                </p>

                {selectedTerritory.parentName && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569' }}>
                    Parent Hierarchy: <strong>{selectedTerritory.parentName}</strong>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenCreate(selectedTerritory.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #DDD6FE',
                    backgroundColor: '#F5F3FF',
                    color: '#7C3AED',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Add child node under this territory"
                >
                  <Plus size={14} />
                  <span>Add Sub-Territory</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedTerritory)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleTerritoryStatus(selectedTerritory.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: selectedTerritory.status === 'Active' ? '#B91C1C' : '#047857',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Power size={14} />
                  <span>{selectedTerritory.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(selectedTerritory);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#B91C1C',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Territory Meta Grid */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px',
                  backgroundColor: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>Commercial Lead</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1E293B' }}>
                    {selectedTerritory.leadPerson || 'Unassigned'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>Sub-Territories Under Node</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#7C3AED' }}>
                    {childTerritories.length} Direct Children
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>Assigned Postal PIN Codes</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1E293B' }}>
                    {selectedTerritory.pinCodes && selectedTerritory.pinCodes.length > 0
                      ? selectedTerritory.pinCodes.join(', ')
                      : 'Inherited from sub-nodes'}
                  </div>
                </div>
              </div>

              {/* Sub-Territories Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    Direct Child Territories under "{selectedTerritory.name}" ({childTerritories.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleOpenCreate(selectedTerritory.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: '#7C3AED',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Child Territory</span>
                  </button>
                </div>

                {childTerritories.length === 0 ? (
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px dashed #CBD5E1',
                      color: '#64748B',
                      fontSize: '13px'
                    }}
                  >
                    No sub-territories configured under this node. Click "+ Add Child Territory" to create level {selectedTerritory.level + 1} jurisdiction.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 12px' }}>Code</th>
                          <th style={{ padding: '8px 12px' }}>Territory Name</th>
                          <th style={{ padding: '8px 12px' }}>Level Label</th>
                          <th style={{ padding: '8px 12px' }}>Lead Person</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {childTerritories.map((child) => (
                          <tr
                            key={child.id}
                            style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                            onClick={() => setSelectedTerritoryId(child.id)}
                          >
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#64748B' }}>
                              {child.code}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>
                              {child.name}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {child.levelLabel || `Level ${child.level}`}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>
                              {child.leadPerson || '—'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusBadge status={child.status} size="sm" />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(child)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '2px' }}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(child);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px' }}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#94A3B8' }}>
            Select a territory from the tree to inspect details.
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CREATE / EDIT TERRITORY MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingTerritory ? `Edit Territory: ${editingTerritory.name}` : 'Configure New Territory'}
        subtitle="Dynamic N-level hierarchy node with circular relationship safeguards."
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="territory-form"
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(124, 58, 237, 0.2)'
              }}
            >
              {editingTerritory ? 'Save Changes' : 'Create Territory'}
            </button>
          </>
        }
      >
        <form id="territory-form" onSubmit={handleSaveTerritory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Territory Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Coastal Andhra Division"
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Territory Code * (Must be Unique)
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. DIV-CAP"
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Level Label (Custom Hierarchy Type)
            </label>
            <input
              type="text"
              value={formLevelLabel}
              onChange={(e) => setFormLevelLabel(e.target.value)}
              placeholder="e.g. State, Operational Division, City Hub, Micro-Market"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
              Dynamic naming gives you total freedom across state, district, zone, or custom micro-markets.
            </span>
          </div>

          {/* Parent Territory Select */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Parent Territory (Leave empty if Root/National)
            </label>
            <select
              value={formParentId || ''}
              onChange={(e) => setFormParentId(e.target.value || null)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                backgroundColor: '#FFFFFF',
                boxSizing: 'border-box'
              }}
            >
              <option value="">(None - Top Level Root Territory)</option>
              {territories
                .filter((t) => (editingTerritory ? t.id !== editingTerritory.id : true))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) - Level {t.level}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Commercial Lead / Zonal Manager
            </label>
            <input
              type="text"
              value={formLead}
              onChange={(e) => setFormLead(e.target.value)}
              placeholder="e.g. K. Sudhakar Rao"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Assigned Postal PIN Codes (Comma-separated)
            </label>
            <input
              type="text"
              value={formPinInput}
              onChange={(e) => setFormPinInput(e.target.value)}
              placeholder="e.g. 520001, 520002, 520010"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Description & Strategy Notes
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Detail medical infrastructure, key hospital accounts, trauma hubs, and logistical corridors..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* DELETE CONFIRM DIALOG */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete Territory: ${deleteTarget?.name}?`}
        message={
          deleteError ||
          `Are you sure you want to permanently delete "${deleteTarget?.name}" (${deleteTarget?.code})? This action cannot be undone if no dependencies exist.`
        }
        confirmLabel="Delete Territory"
        variant="danger"
      />
    </div>
  );
};
