import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import type { TerritoryNode } from '../../types/gtmV2.types';

interface HierarchicalTreeSelectProps {
  territories: TerritoryNode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isMulti?: boolean;
  disabledId?: string; // e.g. when editing a territory, cannot select self
  placeholder?: string;
}

export const HierarchicalTreeSelect: React.FC<HierarchicalTreeSelectProps> = ({
  territories,
  selectedIds,
  onChange,
  isMulti = true,
  disabledId,
  placeholder = 'Select territories...'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'terr-ind': true,
    'terr-ap': true,
    'terr-tel': true
  });

  // Build tree
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

  // Helper to gather all descendant IDs
  const getDescendantIds = (nodeId: string): string[] => {
    const ids: string[] = [];
    const collect = (id: string) => {
      const children = territories.filter((t) => t.parentId === id);
      children.forEach((c) => {
        ids.push(c.id);
        collect(c.id);
      });
    };
    collect(nodeId);
    return ids;
  };

  const handleToggleSelect = (node: TerritoryNode) => {
    if (disabledId && node.id === disabledId) return;

    if (!isMulti) {
      onChange([node.id]);
      return;
    }

    const isCurrentlySelected = selectedIds.includes(node.id);
    const descendants = getDescendantIds(node.id);

    if (isCurrentlySelected) {
      // Deselect node and its descendants
      const toRemove = new Set([node.id, ...descendants]);
      onChange(selectedIds.filter((id) => !toRemove.has(id)));
    } else {
      // Select node and its descendants
      const set = new Set([...selectedIds, node.id, ...descendants]);
      onChange(Array.from(set));
    }
  };

  const handleSelectOnly = (e: React.MouseEvent, node: TerritoryNode) => {
    e.stopPropagation();
    if (disabledId && node.id === disabledId) return;
    if (selectedIds.includes(node.id)) {
      onChange(selectedIds.filter((id) => id !== node.id));
    } else {
      onChange([...selectedIds, node.id]);
    }
  };

  const toggleExpand = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Render tree node recursively
  const renderNode = (node: TerritoryNode & { children?: TerritoryNode[] }, depth = 0) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = Boolean(expandedNodes[node.id]);
    const isSelected = selectedIds.includes(node.id);
    const isDisabled = disabledId === node.id;

    // Filter check
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matches =
        node.name.toLowerCase().includes(q) ||
        node.code.toLowerCase().includes(q) ||
        node.levelLabel?.toLowerCase().includes(q);
      const childMatches = (node.children || []).some(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
      if (!matches && !childMatches) return null;
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
            backgroundColor: isSelected ? '#F5F3FF' : 'transparent',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
            transition: 'background-color 0.12s'
          }}
          onClick={() => !isDisabled && handleToggleSelect(node)}
        >
          {/* Caret */}
          <span
            onClick={(e) => hasChildren && toggleExpand(e, node.id)}
            style={{
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '4px',
              color: '#64748B',
              cursor: hasChildren ? 'pointer' : 'default'
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span style={{ fontSize: '14px', color: '#CBD5E1' }}>•</span>
            )}
          </span>

          {/* Checkbox (Multi-mode) */}
          {isMulti && (
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: `1px solid ${isSelected ? '#7C3AED' : '#CBD5E1'}`,
                backgroundColor: isSelected ? '#7C3AED' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                color: '#FFFFFF',
                flexShrink: 0
              }}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </div>
          )}

          {/* Node Name & Badges */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#5B21B6' : '#1E293B' }}>
              {node.name}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                backgroundColor: '#F1F5F9',
                color: '#64748B',
                padding: '1px 5px',
                borderRadius: '4px'
              }}
            >
              {node.code}
            </span>
            {node.levelLabel && (
              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>({node.levelLabel})</span>
            )}
          </div>

          {/* Optional: Select Just This (exclude sub-nodes) */}
          {isMulti && hasChildren && (
            <button
              type="button"
              onClick={(e) => handleSelectOnly(e, node)}
              style={{
                fontSize: '11px',
                color: '#7C3AED',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              title="Select or deselect this specific node only without affecting descendants"
            >
              {isSelected ? 'Deselect node' : 'Select only'}
            </button>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {(node.children as any).map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedTerritories = territories.filter((t) => selectedIds.includes(t.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Selected Chips Preview */}
      {selectedIds.length > 0 && isMulti && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', padding: '4px 0' }}>
          {selectedTerritories.slice(0, 12).map((t) => (
            <span
              key={t.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#F3E8FF',
                color: '#6B21A8',
                border: '1px solid #DDD6FE',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11.5px',
                fontWeight: 500
              }}
            >
              <span>{t.name}</span>
              <X
                size={12}
                style={{ cursor: 'pointer', opacity: 0.7 }}
                onClick={() => onChange(selectedIds.filter((id) => id !== t.id))}
              />
            </span>
          ))}
          {selectedIds.length > 12 && (
            <span style={{ fontSize: '11.5px', color: '#7C3AED', alignSelf: 'center', fontWeight: 600 }}>
              +{selectedIds.length - 12} more
            </span>
          )}
        </div>
      )}

      {/* Search Input */}
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
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '34px',
            paddingLeft: '32px',
            paddingRight: '12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '12.5px',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Hierarchy Tree Container */}
      <div
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          maxHeight: '280px',
          overflowY: 'auto',
          padding: '6px',
          backgroundColor: '#FFFFFF'
        }}
      >
        {treeRoots.map((root) => renderNode(root, 0))}
      </div>
    </div>
  );
};
