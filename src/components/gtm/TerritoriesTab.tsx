import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { Territory } from '../../types/gtm.ts';
import { TerritoryDrawer } from './TerritoryDrawer.tsx';
import { 
  Plus, 
  MapPin, 
  Edit3, 
  Clock, 
  Power, 
  Compass,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export interface HierarchyTreeNode {
  id: string;
  name: string;
  type: 'Country' | 'Zone' | 'State' | 'Territory' | 'District' | 'City' | 'Locality' | 'PIN';
  status?: string;
  territoryId?: string;
  pinCodes?: string[];
  children?: HierarchyTreeNode[];
  itemData?: Territory;
}

export const TerritoriesTab: React.FC = () => {
  const {
    territories,
    partners,
    distributionRoutes,
    toggleTerritoryStatus
  } = useApp();

  // Search & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>(
    territories[0]?.id || 'terr-telangana'
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    'dist-terr-telangana-Andhra Pradesh-NTR District'
  );
  const [selectedNodeData, setSelectedNodeData] = useState<{
    name: string;
    type: string;
    state?: string;
    district?: string;
    city?: string;
    locality?: string;
  } | null>({
    name: 'NTR District',
    type: 'District',
    state: 'Andhra Pradesh',
    district: 'NTR District'
  });

  const [activeDetailTab, setActiveDetailTab] = useState<
    'overview' | 'geography' | 'partners' | 'commercial' | 'routes' | 'rules' | 'history'
  >('overview');
  const [lifecycleFilter, setLifecycleFilter] = useState<'ALL' | 'Active' | 'Draft' | 'Archived'>('ALL');

  // Tree expand/collapse state: State-First geographic hierarchy
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'country-India': true,
    'zone-India-South Zone': true,
    'state-India-South Zone-Andhra Pradesh': true,
    'terr-terr-telangana-Andhra Pradesh': true,
    'dist-terr-telangana-Andhra Pradesh-NTR District': true,
    'city-terr-telangana-Andhra Pradesh-NTR District-Vijayawada': true,
    'dist-terr-telangana-Andhra Pradesh-Visakhapatnam District': true,
    'terr-terr-cds-Andhra Pradesh': true,
    'dist-terr-cds-Andhra Pradesh-West Godavari District': true,
    'city-terr-cds-Andhra Pradesh-West Godavari District-Eluru': true,
    'state-India-South Zone-Telangana': true,
    'terr-terr-telangana-Telangana': true,
    'dist-terr-telangana-Telangana-Hyderabad District': true,
    'city-terr-telangana-Telangana-Hyderabad District-Hyderabad': true,
    'state-India-South Zone-Karnataka': false,
    'state-India-South Zone-Tamil Nadu': false
  });

  // Modal / Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);

  // Build the complete recursive State-First hierarchy tree:
  // Country -> Zone -> State -> Territory -> District -> City -> Locality -> PIN
  const fullHierarchyTree = useMemo(() => {
    // Filter territories by Model Lifecycle State (Salesforce ETM benchmark)
    const modelTerritories = territories.filter((t) => {
      if (lifecycleFilter === 'ALL') return true;
      const state = t.lifecycleState || (t.status === 'Draft' ? 'Draft' : t.status === 'Inactive' ? 'Archived' : 'Active');
      return state === lifecycleFilter;
    });

    // 1. Group by Country
    const countryMap = new Map<string, Territory[]>();
    modelTerritories.forEach((t) => {
      const c = t.country || 'India';
      if (!countryMap.has(c)) countryMap.set(c, []);
      countryMap.get(c)!.push(t);
    });

    const countries: HierarchyTreeNode[] = [];

    countryMap.forEach((cTerritories, countryName) => {
      // 2. Group by Zone
      const zoneMap = new Map<string, Territory[]>();
      cTerritories.forEach((t) => {
        const z = t.zone || 'South Zone';
        if (!zoneMap.has(z)) zoneMap.set(z, []);
        zoneMap.get(z)!.push(t);
      });

      const zones: HierarchyTreeNode[] = [];

      // Sort zones: South Zone first
      const sortedZones = Array.from(zoneMap.entries()).sort(([a], [b]) => {
        if (a.includes('South')) return -1;
        if (b.includes('South')) return 1;
        return a.localeCompare(b);
      });

      sortedZones.forEach(([zoneName, zTerritories]) => {
        // 3. Group by State under Zone (State is above Territory!)
        const stateMap = new Map<string, Array<{ territory: Territory; areas: typeof zTerritories[0]['geographicCoverage'] }>>();

        zTerritories.forEach((t) => {
          const coverage = t.geographicCoverage || [];
          if (coverage.length > 0) {
            const statesInCoverage = new Set<string>();
            coverage.forEach((area) => {
              const s = area.state || t.state || 'General State';
              statesInCoverage.add(s);
            });

            statesInCoverage.forEach((stateName) => {
              if (!stateMap.has(stateName)) stateMap.set(stateName, []);
              stateMap.get(stateName)!.push({
                territory: t,
                areas: coverage.filter((a) => (a.state || t.state || 'General State') === stateName)
              });
            });
          } else {
            // Uncovered / Draft territory mapped by primary state property
            const stateName = t.state || 'General State';
            if (!stateMap.has(stateName)) stateMap.set(stateName, []);
            stateMap.get(stateName)!.push({
              territory: t,
              areas: []
            });
          }
        });

        const stateNodes: HierarchyTreeNode[] = [];

        // Sort states: Andhra Pradesh first, Telangana second, Karnataka third, Tamil Nadu fourth
        const sortedStates = Array.from(stateMap.entries()).sort(([a], [b]) => {
          if (a.includes('Andhra')) return -1;
          if (b.includes('Andhra')) return 1;
          if (a.includes('Telangana')) return -1;
          if (b.includes('Telangana')) return 1;
          if (a.includes('Karnataka')) return -1;
          if (b.includes('Karnataka')) return 1;
          return a.localeCompare(b);
        });

        sortedStates.forEach(([stateName, stateTerritoryEntries]) => {
          const territoryNodes: HierarchyTreeNode[] = [];

          // Sort territories inside state: AP & Telangana first, CDS second, etc.
          const sortedEntries = [...stateTerritoryEntries].sort((a, b) => {
            if (a.territory.name.includes('AP & Telangana')) return -1;
            if (b.territory.name.includes('AP & Telangana')) return 1;
            return a.territory.name.localeCompare(b.territory.name);
          });

          sortedEntries.forEach(({ territory: t, areas }) => {
            // 4. Group by District under Territory
            const districtMap = new Map<string, typeof areas>();
            (areas || []).forEach((area) => {
              const d = area.district || (area.city ? `${area.city} District` : `${stateName} District`);
              if (!districtMap.has(d)) districtMap.set(d, []);
              districtMap.get(d)!.push(area);
            });

            const districtNodes: HierarchyTreeNode[] = [];

            // Sort districts: NTR District first, Visakhapatnam second
            const sortedDistricts = Array.from(districtMap.entries()).sort(([a], [b]) => {
              if (a.includes('NTR')) return -1;
              if (b.includes('NTR')) return 1;
              return a.localeCompare(b);
            });

            sortedDistricts.forEach(([districtName, dAreas]) => {
              // 5. Group by City under District
              const cityMap = new Map<string, NonNullable<typeof dAreas>>();
              (dAreas || []).forEach((area) => {
                const c = area.city || districtName.replace(' District', '') || 'City Hub';
                if (!cityMap.has(c)) cityMap.set(c, []);
                cityMap.get(c)!.push(area);
              });

              const cityNodes: HierarchyTreeNode[] = [];

              cityMap.forEach((cAreas, cityName) => {
                // 6. Localities under City
                const localityNodes: HierarchyTreeNode[] = [];
                const seenLocalities = new Set<string>();

                (cAreas || []).forEach((area) => {
                  if (area.locality && area.locality.trim()) {
                    const locs = area.locality.includes(',')
                      ? area.locality.split(',').map((l) => l.trim()).filter(Boolean)
                      : [area.locality.trim()];

                    locs.forEach((loc) => {
                      if (!seenLocalities.has(loc)) {
                        seenLocalities.add(loc);

                        // PIN codes under Locality
                        const pinNodes: HierarchyTreeNode[] = (area.pinCodes || []).map((pin) => ({
                          id: `pin-${t.id}-${loc}-${pin}`,
                          name: pin,
                          type: 'PIN',
                          territoryId: t.id
                        }));

                        localityNodes.push({
                          id: `loc-${t.id}-${stateName}-${districtName}-${cityName}-${loc}`,
                          name: loc,
                          type: 'Locality',
                          territoryId: t.id,
                          pinCodes: area.pinCodes,
                          children: pinNodes.length > 0 ? pinNodes : undefined
                        });
                      }
                    });
                  }
                });

                cityNodes.push({
                  id: `city-${t.id}-${stateName}-${districtName}-${cityName}`,
                  name: cityName,
                  type: 'City',
                  territoryId: t.id,
                  children: localityNodes.length > 0 ? localityNodes : undefined
                });
              });

              districtNodes.push({
                id: `dist-${t.id}-${stateName}-${districtName}`,
                name: districtName,
                type: 'District',
                territoryId: t.id,
                children: cityNodes.length > 0 ? cityNodes : undefined
              });
            });

            territoryNodes.push({
              id: `terr-${t.id}-${stateName}`,
              name: t.name,
              type: 'Territory',
              status: t.status,
              territoryId: t.id,
              children: districtNodes.length > 0 ? districtNodes : undefined,
              itemData: t
            });
          });

          stateNodes.push({
            id: `state-${countryName}-${zoneName}-${stateName}`,
            name: stateName,
            type: 'State',
            children: territoryNodes
          });
        });

        zones.push({
          id: `zone-${countryName}-${zoneName}`,
          name: zoneName,
          type: 'Zone',
          children: stateNodes
        });
      });

      countries.push({
        id: `country-${countryName}`,
        name: countryName,
        type: 'Country',
        children: zones
      });
    });

    return countries;
  }, [territories, lifecycleFilter]);

  // Filter tree by search term
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return fullHierarchyTree;
    const q = searchTerm.toLowerCase().trim();

    const filterNode = (node: HierarchyTreeNode): HierarchyTreeNode | null => {
      const nameMatch = node.name.toLowerCase().includes(q);
      const typeMatch = node.type.toLowerCase().includes(q);
      const pinMatch = node.pinCodes?.some((p) => p.toLowerCase().includes(q));

      const filteredChildren: HierarchyTreeNode[] = [];
      if (node.children) {
        node.children.forEach((c) => {
          const res = filterNode(c);
          if (res) filteredChildren.push(res);
        });
      }

      if (nameMatch || typeMatch || pinMatch || filteredChildren.length > 0) {
        return {
          ...node,
          children: node.children ? filteredChildren : undefined
        };
      }
      return null;
    };

    const result: HierarchyTreeNode[] = [];
    fullHierarchyTree.forEach((root) => {
      const filteredRoot = filterNode(root);
      if (filteredRoot) result.push(filteredRoot);
    });
    return result;
  }, [fullHierarchyTree, searchTerm]);

  // Auto-expand all matching nodes when searching
  useEffect(() => {
    if (searchTerm.trim()) {
      const allMatchingIds: Record<string, boolean> = {};
      const collectIds = (nodes: HierarchyTreeNode[]) => {
        nodes.forEach((n) => {
          allMatchingIds[n.id] = true;
          if (n.children) collectIds(n.children);
        });
      };
      collectIds(filteredTree);
      setExpandedNodes((prev) => ({ ...prev, ...allMatchingIds }));
    }
  }, [searchTerm, filteredTree]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => {
    const allIds: Record<string, boolean> = {};
    const collectIds = (nodes: HierarchyTreeNode[]) => {
      nodes.forEach((n) => {
        allIds[n.id] = true;
        if (n.children) collectIds(n.children);
      });
    };
    collectIds(fullHierarchyTree);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const handleSelectNode = (node: HierarchyTreeNode) => {
    setSelectedNodeId(node.id);
    setSelectedNodeData({
      name: node.name,
      type: node.type,
      state: node.type === 'State' ? node.name : undefined,
      district: node.type === 'District' ? node.name : undefined,
      city: node.type === 'City' ? node.name : undefined,
      locality: node.type === 'Locality' ? node.name : undefined
    });

    if (node.territoryId) {
      setSelectedTerritoryId(node.territoryId);
    }
  };

  // Helper to cleanly strip redundant suffix word (e.g. "South Zone" + "Zone" -> "South")
  const getCleanNodeName = (name: string, type: string) => {
    if (!name) return '';
    const trimmed = name.trim();
    if (trimmed.toLowerCase().endsWith(type.toLowerCase())) {
      const stripped = trimmed.slice(0, trimmed.length - type.length).trim();
      return stripped || trimmed;
    }
    return trimmed;
  };

  // Recursive Tree Node Renderer matching the reference wireframe exactly
  const renderTreeNode = (node: HierarchyTreeNode, depth: number) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = Boolean(expandedNodes[node.id]);
    const isSelected = selectedNodeId === node.id;
    const cleanName = getCleanNodeName(node.name, node.type);

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            minHeight: '28px',
            paddingLeft: `${depth * 18 + 6}px`,
            paddingRight: '8px',
            paddingTop: '2px',
            paddingBottom: '2px',
            borderRadius: '6px',
            backgroundColor: isSelected ? '#eff6ff' : 'transparent',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background-color 0.12s ease'
          }}
          onClick={() => handleSelectNode(node)}
        >
          {/* Caret / Leaf Bullet */}
          <span
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                toggleNode(node.id);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              marginRight: '6px',
              color: '#64748b',
              fontSize: hasChildren ? '10.5px' : '15px',
              lineHeight: 1,
              cursor: hasChildren ? 'pointer' : 'default',
              flexShrink: 0
            }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
          </span>

          {/* Clean Node Name */}
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: isSelected ? 600 : 400,
              color: isSelected ? '#1e40af' : '#1e293b',
              whiteSpace: 'nowrap'
            }}
          >
            {cleanName}
          </span>

          {/* Type Label */}
          <span
            style={{
              fontSize: '12.5px',
              color: isSelected ? '#3b82f6' : '#64748b',
              marginLeft: '6px',
              fontWeight: 400,
              whiteSpace: 'nowrap'
            }}
          >
            {node.type}
          </span>

          {/* Status Badge (e.g. Draft in amber pill) */}
          {node.status === 'Draft' && (
            <span
              style={{
                marginLeft: '8px',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 8px',
                borderRadius: '9999px',
                lineHeight: '16px'
              }}
            >
              Draft
            </span>
          )}
        </div>

        {/* Children Sub-Tree */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Selected territory object
  const selectedTerritory = useMemo(() => {
    return territories.find((t) => t.id === selectedTerritoryId) || territories[0];
  }, [territories, selectedTerritoryId]);

  // Partners operating in selected territory (Unique Partners)
  const territoryPartners = useMemo(() => {
    if (!selectedTerritory) return [];
    return partners.filter((p) => p.assignedTerritoryIds?.includes(selectedTerritory.id));
  }, [partners, selectedTerritory]);

  // Partner-Channel Assignments in selected territory
  const territoryChannelAssignments = useMemo(() => {
    if (!selectedTerritory) return [];
    const list: any[] = [];
    territoryPartners.forEach((p) => {
      (p.channelAssignments || []).forEach((ca) => {
        if (!ca.territoryScope || ca.territoryScope.includes(selectedTerritory.id)) {
          list.push({ ...ca, partner: p });
        }
      });
    });
    return list;
  }, [territoryPartners, selectedTerritory]);

  // Calculate distinct metrics for selected territory
  const metrics = useMemo(() => {
    const activePartnersCount = territoryPartners.filter((p) => p.status === 'Active').length;
    const standardAssignments = territoryChannelAssignments.filter(
      (a) => a.commercialTermStatus === 'Standard'
    ).length;
    const deviatedAssignments = territoryChannelAssignments.filter(
      (a) => a.commercialTermStatus?.startsWith('Deviated')
    ).length;
    const pendingApprovals = territoryChannelAssignments.filter(
      (a) => a.commercialTermStatus === 'Deviated — Pending Approval'
    ).length;
    
    const coveredAreasCount = selectedTerritory?.geographicCoverage?.length || 0;
    const coveredPinsCount = Array.from(
      new Set((selectedTerritory?.geographicCoverage || []).flatMap((a) => a.pinCodes))
    ).length;

    return {
      activePartnersCount,
      standardAssignments,
      deviatedAssignments,
      pendingApprovals,
      coveredAreasCount,
      coveredPinsCount
    };
  }, [territoryPartners, territoryChannelAssignments, selectedTerritory]);

  // Routes associated with selected territory
  const territoryRoutes = useMemo(() => {
    if (!selectedTerritory) return [];
    return distributionRoutes.filter((r) =>
      r.applicableTerritoryIds.includes(selectedTerritory.id)
    );
  }, [distributionRoutes, selectedTerritory]);

  const openCreateDrawer = () => {
    setEditingTerritory(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (t: Territory) => {
    setEditingTerritory(t);
    setIsDrawerOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={18} className="text-blue-600" />
            <span>Territory Management & Geographic Hierarchy</span>
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
            Enterprise geographic boundaries: Country &rarr; Zone &rarr; State &rarr; Territory &rarr; District &rarr; City &rarr; Localities & Postal PIN Codes.
          </p>
        </div>

        <button
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={openCreateDrawer}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>New Territory</span>
        </button>
      </div>

      {/* Two-Panel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', minHeight: '620px', alignItems: 'stretch' }}>
        
        {/* LEFT PANEL: Geographic Hierarchy Tree */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Model Lifecycle Filter Pills (Salesforce ETM Benchmark) */}
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['ALL', 'Active', 'Draft', 'Archived'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setLifecycleFilter(mode)}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: lifecycleFilter === mode ? 600 : 500,
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: lifecycleFilter === mode ? '#2563eb' : 'var(--vf-slate-300)',
                  background: lifecycleFilter === mode ? '#eff6ff' : '#ffffff',
                  color: lifecycleFilter === mode ? '#1d4ed8' : 'var(--vf-slate-600)',
                  cursor: 'pointer'
                }}
              >
                {mode === 'ALL' ? 'All Models' : mode === 'Active' ? 'Active (Prod)' : mode === 'Draft' ? 'Draft' : 'Archived'}
              </button>
            ))}
          </div>

          {/* Top Search & Expand/Collapse Controls */}
          <div style={{ padding: '12px 14px 10px 14px', borderBottom: '1px solid var(--vf-slate-100)' }}>
            <input
              type="text"
              placeholder="Search name or PIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                border: '1px solid var(--vf-slate-300)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--vf-slate-800)',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px', fontSize: '11px' }}>
              <button 
                type="button" 
                onClick={expandAll} 
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '1px 4px' }}
              >
                Expand all
              </button>
              <span style={{ color: 'var(--vf-slate-300)' }}>|</span>
              <button 
                type="button" 
                onClick={collapseAll} 
                style={{ background: 'none', border: 'none', color: 'var(--vf-slate-500)', cursor: 'pointer', padding: '1px 4px' }}
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* Tree Nodes List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {filteredTree.map((rootNode) => renderTreeNode(rootNode, 0))}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Territory Details */}
        {selectedTerritory ? (
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Selected Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                    {selectedTerritory.name}
                  </h2>
                  <span className="vf-badge vf-badge-outline">{selectedTerritory.code}</span>
                  <span className={`vf-badge ${selectedTerritory.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                    {selectedTerritory.status}
                  </span>
                  <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px' }}>
                    {selectedTerritory.zone}
                  </span>
                  <span className="vf-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '11px', fontWeight: 600 }}>
                    Priority: {selectedTerritory.priorityScore || 80}/100
                  </span>
                  <span className="vf-badge" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                    Coverage: {selectedTerritory.coverageRatio !== undefined ? `${selectedTerritory.coverageRatio}%` : '96.2%'}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  {selectedTerritory.description || `State: ${selectedTerritory.state} • Primary Hub: ${selectedTerritory.city || selectedTerritory.district}`}
                </p>
                {selectedNodeData && selectedNodeData.type !== 'Territory' && (
                  <div style={{ fontSize: '11.5px', color: '#1e40af', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} />
                    <span>Selected Hierarchy Node: <strong>{selectedNodeData.name}</strong> ({selectedNodeData.type})</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={() => openEditDrawer(selectedTerritory)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Edit3 size={14} />
                  <span>Edit Territory</span>
                </button>

                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={() => toggleTerritoryStatus(selectedTerritory.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                  title="Toggle status"
                >
                  <Power size={14} className={selectedTerritory.status === 'Active' ? 'text-red-500' : 'text-green-500'} />
                  <span>{selectedTerritory.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </button>
              </div>
            </div>

            {/* 6 Summary Metric Cards for this Territory (Salesforce ETM & Coverage Benchmarks) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--vf-slate-200)' }}>
              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Active Partners</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{metrics.activePartnersCount}</div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Unique partners</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Coverage Ratio</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>
                  {selectedTerritory.coverageRatio !== undefined ? `${selectedTerritory.coverageRatio}%` : '96.2%'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Benchmark &ge; 92%</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Priority Score</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1d4ed8' }}>
                  {selectedTerritory.priorityScore || 80}<span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>/100</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Deterministic rank</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Pending Approvals</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: metrics.pendingApprovals > 0 ? '#dc2626' : 'var(--vf-slate-800)' }}>
                  {metrics.pendingApprovals}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Commercial queue</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Coverage Areas</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{metrics.coveredAreasCount}</div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Districts / cities</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Covered PINs</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{metrics.coveredPinsCount}</div>
                <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Postal postal codes</div>
              </div>
            </div>

            {/* Detail Tabs Bar */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--vf-slate-200)', padding: '0 20px', background: '#ffffff' }}>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('overview')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                1. Overview
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'geography' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('geography')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                2. Geographic Coverage ({metrics.coveredAreasCount})
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'partners' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('partners')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                3. Partners ({territoryPartners.length})
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'commercial' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('commercial')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                4. Commercial Terms
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'routes' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('routes')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                5. Sales Routes ({territoryRoutes.length})
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'rules' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('rules')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                6. Account Rules & Predicates
              </button>
              <button
                type="button"
                className={`vf-tab-btn ${activeDetailTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('history')}
                style={{ fontSize: '12.5px', padding: '10px 14px' }}
              >
                7. History & Audit
              </button>
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              
              {/* TAB 1: OVERVIEW */}
              {activeDetailTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '4px' }}>Zonal Commercial Lead</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vf-slate-800)' }}>{selectedTerritory.lead}</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '4px' }}>Annual Sales Target</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>
                        ₹{(selectedTerritory.annualTarget / 10000000).toFixed(2)} Crore
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '4px' }}>Parent Zone / Node</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vf-slate-800)' }}>
                        {selectedTerritory.parentTerritoryName || selectedTerritory.zone || 'National Headquarters'}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '6px' }}>
                      Primary Sales Channel & Default Route
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                      <div>Channel: <strong>{selectedTerritory.assignedChannelName}</strong></div>
                      <div>Primary Route: <strong>{selectedTerritory.assignedRouteName}</strong></div>
                      <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>
                        Effective Period: {selectedTerritory.effectiveFrom} {selectedTerritory.effectiveTo ? `to ${selectedTerritory.effectiveTo}` : '(Ongoing)'}
                      </div>
                    </div>
                  </div>

                  {selectedTerritory.notes && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '4px' }}>
                        Operational Notes & Strategy
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', lineHeight: '1.5' }}>
                        {selectedTerritory.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: GEOGRAPHIC COVERAGE */}
              {activeDetailTab === 'geography' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                    Detailed list of geographic areas, administrative districts, healthcare clusters, and postal PIN codes assigned to <strong>{selectedTerritory.name}</strong>.
                  </div>

                  <div className="vf-table-container">
                    <table className="vf-table">
                      <thead>
                        <tr>
                          <th>Country</th>
                          <th>Zone</th>
                          <th>State</th>
                          <th>District / City</th>
                          <th>Locality / Cluster</th>
                          <th>Assigned Postal PINs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTerritory.geographicCoverage || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--vf-slate-400)', padding: '24px' }}>
                              No sub-area clusters configured. Use "Edit Territory" to add coverage areas.
                            </td>
                          </tr>
                        ) : (
                          (selectedTerritory.geographicCoverage || []).map((area) => (
                            <tr key={area.id}>
                              <td>{area.country}</td>
                              <td><span className="vf-badge vf-badge-outline">{area.zone}</span></td>
                              <td><strong>{area.state}</strong></td>
                              <td>{area.district || area.city}</td>
                              <td>
                                {area.locality ? (
                                  <span style={{ fontWeight: 600, color: 'var(--vf-slate-800)' }}>
                                    {area.locality}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--vf-slate-400)', fontStyle: 'italic' }}>
                                    Full District
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {(area.pinCodes || []).map((pin) => (
                                    <span 
                                      key={pin} 
                                      style={{ 
                                        background: '#f1f5f9', 
                                        color: '#334155', 
                                        border: '1px solid #cbd5e1', 
                                        borderRadius: '4px', 
                                        padding: '1px 6px', 
                                        fontSize: '11px',
                                        fontFamily: 'monospace'
                                      }}
                                    >
                                      {pin}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PARTNERS */}
              {activeDetailTab === 'partners' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                    Commercial partners authorized to operate and fulfill orders in <strong>{selectedTerritory.name}</strong> ({territoryPartners.length} registered partners).
                  </div>

                  <div className="vf-table-container">
                    <table className="vf-table">
                      <thead>
                        <tr>
                          <th>Partner Name</th>
                          <th>Type</th>
                          <th>Performance Tier</th>
                          <th>Status</th>
                          <th>Assigned Channel</th>
                          <th>Contact Person</th>
                        </tr>
                      </thead>
                      <tbody>
                        {territoryPartners.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--vf-slate-400)', padding: '24px' }}>
                              No partners currently assigned to this territory.
                            </td>
                          </tr>
                        ) : (
                          territoryPartners.map((partner) => (
                            <tr key={partner.id}>
                              <td>
                                <strong>{partner.name}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{partner.code}</div>
                              </td>
                              <td>
                                <span className="vf-badge vf-badge-outline">{partner.typeName || 'Distributor'}</span>
                              </td>
                              <td>
                                <span className="vf-badge vf-badge-active" style={{ background: partner.classification?.performanceTierName?.includes('Platinum') ? '#fdf4ff' : partner.classification?.performanceTierName?.includes('Gold') ? '#fffbeb' : '#f1f5f9', color: partner.classification?.performanceTierName?.includes('Platinum') ? '#86198f' : partner.classification?.performanceTierName?.includes('Gold') ? '#b45309' : '#334155' }}>
                                  {partner.classification?.performanceTierName || 'Standard Partner'}
                                </span>
                              </td>
                              <td>
                                <span className={`vf-badge ${partner.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                                  {partner.status}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                {partner.channelAssignments?.[0]?.salesChannelName || 'Authorized Distributor'}
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                                {partner.authorizedContactPerson || partner.officialEmail || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: COMMERCIAL TERMS */}
              {activeDetailTab === 'commercial' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                        Territory Commercial Terms & Channel Baseline
                      </div>
                      <span className="vf-badge vf-badge-outline" style={{ background: '#ffffff', color: '#1d4ed8' }}>
                        Linked Channel: {selectedTerritory.assignedChannelName}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: '1.4' }}>
                      <em>Commercial terms are auto-aligned with primary channel <strong>{selectedTerritory.assignedChannelName}</strong>. Partner-level deviations are tracked and approved independently below.</em>
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px' }}>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid var(--vf-slate-200)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Territory Default Discount</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>
                          {selectedTerritory.defaultCommercialTerms?.defaultDiscountPercent}%
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid var(--vf-slate-200)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Standard Credit Period</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                          {selectedTerritory.defaultCommercialTerms?.creditPeriodDays} Days
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid var(--vf-slate-200)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Credit Limit Floor</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                          ₹{((selectedTerritory.defaultCommercialTerms?.creditLimit || 0) / 100000).toFixed(1)} Lakh
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid var(--vf-slate-200)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Security Deposit</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                          ₹{((selectedTerritory.defaultCommercialTerms?.minimumSecurityDeposit || 0) / 100000).toFixed(1)} Lakh
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Partner Commercial Overrides in this Territory */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px' }}>
                      Active Partner Commercial Overrides in this Territory ({territoryChannelAssignments.filter((a) => a.commercialTermStatus?.startsWith('Deviated')).length})
                    </div>
                    <div className="vf-table-container">
                      <table className="vf-table">
                        <thead>
                          <tr>
                            <th>Partner</th>
                            <th>Sales Channel</th>
                            <th>Channel Default</th>
                            <th>Effective Discount</th>
                            <th>Commercial Status</th>
                            <th>Override Justification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {territoryChannelAssignments.map((a, idx) => (
                            <tr key={idx}>
                              <td>
                                <strong>{a.partner.name}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{a.partner.code}</div>
                              </td>
                              <td>{a.salesChannelName}</td>
                              <td>{a.commercialOverride?.channelDefaultDiscount || 12.0}%</td>
                              <td>
                                <strong style={{ color: a.commercialTermStatus?.startsWith('Deviated') ? '#b45309' : '#047857' }}>
                                  {a.commercialOverride?.overrideDiscountPercent || a.commercialOverride?.channelDefaultDiscount || 12.0}%
                                </strong>
                              </td>
                              <td>
                                <span className={`vf-badge ${a.commercialTermStatus === 'Deviated — Approved' ? 'vf-badge-approved' : a.commercialTermStatus === 'Deviated — Pending Approval' ? 'vf-badge-warning' : 'vf-badge-active'}`}>
                                  {a.commercialTermStatus}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                                {a.commercialOverride?.requestReason || 'Channel Standard Terms'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SALES ROUTES */}
              {activeDetailTab === 'routes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                    Distribution routes authorized to supply into <strong>{selectedTerritory.name}</strong> ({territoryRoutes.length} active paths).
                  </div>

                  {territoryRoutes.map((route) => (
                    <div 
                      key={route.id}
                      style={{ 
                        background: '#f8fafc', 
                        padding: '14px 16px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--vf-slate-200)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                            {route.name}
                          </span>
                          <span className="vf-badge vf-badge-outline">{route.code}</span>
                          <span className="vf-badge vf-badge-approved">{route.routeType}</span>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>
                          Model: {route.commercialModel}
                        </span>
                      </div>

                      {/* Visual Node Flow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '4px 0' }}>
                        {route.nodes.map((node, nIdx) => (
                          <React.Fragment key={node.id || nIdx}>
                            <div 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                background: '#ffffff', 
                                border: '1px solid var(--vf-slate-200)', 
                                padding: '3px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11.5px' 
                              }}
                            >
                              <span style={{ fontWeight: 600, color: 'var(--vf-slate-800)' }}>
                                {node.label}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>
                                ({node.pricingPoint})
                              </span>
                            </div>
                            {nIdx < route.nodes.length - 1 && (
                              <ArrowRight size={13} style={{ color: 'var(--vf-slate-400)' }} />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 6: ACCOUNT RULES & PREDICATES (Salesforce ETM & SAP CODTERRITORY Benchmark) */}
              {activeDetailTab === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={15} className="text-blue-600" />
                        <span>Salesforce ETM Multi-Attribute Predicates & Assignment Rules</span>
                      </div>
                      <span className="vf-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                        Deterministic Priority Score: {selectedTerritory.priorityScore || 80}/100
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: '1.4' }}>
                      <em>Multi-attribute predicates decouple geographic boundaries from account quotas. Accounts satisfying institutional predicates are deterministically routed to this territory model.</em>
                    </p>
                  </div>

                  {/* Predicates Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '8px' }}>
                        Qualifying Healthcare Facility Types
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(selectedTerritory.assignmentPredicates?.facilityTypes || [
                          'Corporate Tertiary Hospital',
                          'Government Medical College',
                          'Specialist Surgical Center'
                        ]).map((ft, idx) => (
                          <span key={idx} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '3px 8px', fontSize: '11.5px', fontWeight: 500 }}>
                            {ft}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '8px' }}>
                        Institutional Bed Threshold & Spend Capacity
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--vf-slate-700)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--vf-slate-500)' }}>Minimum Bed Count:</span>
                          <strong>&ge; {selectedTerritory.assignmentPredicates?.minBedCount || 100} Beds</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--vf-slate-500)' }}>Minimum Spend Potential:</span>
                          <strong>₹{(((selectedTerritory.assignmentPredicates?.minSpendCapacity || 10000000)) / 10000000).toFixed(2)} Crore / Year</strong>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ color: 'var(--vf-slate-500)' }}>Required Clinical Specialties:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                            {(selectedTerritory.assignmentPredicates?.requiredSpecialties || ['Orthopedic Surgery', 'Trauma Care Level-1', 'Robotic OT']).map((sp, idx) => (
                              <span key={idx} style={{ background: '#f1f5f9', color: '#334155', borderRadius: '3px', padding: '2px 6px', fontSize: '11px' }}>
                                {sp}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deterministic Conflict Resolution Matrix */}
                  <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px' }}>
                      Deterministic Overlap & Conflict Arbitration Policy
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: '1.5' }}>
                      When hospital accounts or surgical centers have overlapping postal PIN codes across multiple territories, <strong>Salesforce ETM priority scoring</strong> arbitrates primary territory ownership:
                      <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                        <li>Territory Priority Score: <strong>{selectedTerritory.priorityScore || 80}/100</strong> (Ranks higher than secondary dealer channels scored at 60-70).</li>
                        <li>Accounts satisfying both geographic boundaries and facility bed count predicates receive primary quota credit here.</li>
                        <li>Coverage Ratio: <strong>{selectedTerritory.coverageRatio !== undefined ? `${selectedTerritory.coverageRatio}%` : '96.2%'}</strong> (Benchmark: &ge; 92.0% coverage).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: HISTORY & AUDIT */}
              {activeDetailTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', marginBottom: '4px' }}>
                    Audit trail of geographic revisions and statutory commercial updates for <strong>{selectedTerritory.name}</strong>.
                  </div>

                  <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '12px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {(selectedTerritory.history || []).map((h) => (
                      <div key={h.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-22px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }} />
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          <span>{h.timestamp}</span>
                          <span>•</span>
                          <span>{h.performedBy}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--vf-slate-800)', marginTop: '2px' }}>
                          {h.action}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)', marginTop: '2px' }}>
                          {h.details}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', color: 'var(--vf-slate-400)' }}>
            Select a territory from the tree to inspect details.
          </div>
        )}
      </div>

      {/* Territory Create / Edit Drawer */}
      <TerritoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        territory={editingTerritory}
      />
    </div>
  );
};
