import React, { useState } from 'react';
import {
  Globe2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  AlertCircle
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { Zone } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { HierarchicalTreeSelect } from '../../components/common/HierarchicalTreeSelect';

export const ZoneManagementPage: React.FC = () => {
  const { zones, territories, addZone, updateZone, deleteZone, toggleZoneStatus } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLead, setFormLead] = useState('');
  const [formBudget, setFormBudget] = useState(100000000);
  const [formSelectedTerritoryIds, setFormSelectedTerritoryIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Dialog
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);

  // Filter zones by search
  const filteredZones = zones.filter((z) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      z.name.toLowerCase().includes(q) ||
      z.code.toLowerCase().includes(q) ||
      z.description.toLowerCase().includes(q) ||
      z.leadManager?.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingZone(null);
    setFormName('');
    setFormCode(`ZONE-${Math.floor(100 + Math.random() * 900)}`);
    setFormDescription('');
    setFormLead('Zonal Commercial Director');
    setFormBudget(150000000);
    setFormSelectedTerritoryIds(['terr-ap', 'terr-vja']);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (z: Zone) => {
    setEditingZone(z);
    setFormName(z.name);
    setFormCode(z.code);
    setFormDescription(z.description);
    setFormLead(z.leadManager || '');
    setFormBudget(z.annualBudget || 0);
    setFormSelectedTerritoryIds(z.territoryIds || []);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Zone Name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Zone Code is required.');
      return;
    }
    if (formSelectedTerritoryIds.length === 0) {
      setFormError('Select at least one territory to map to this strategic zone.');
      return;
    }

    if (editingZone) {
      updateZone(editingZone.id, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim(),
        leadManager: formLead.trim(),
        annualBudget: Number(formBudget),
        territoryIds: formSelectedTerritoryIds
      });
    } else {
      addZone({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim(),
        status: 'Active',
        leadManager: formLead.trim(),
        annualBudget: Number(formBudget),
        territoryIds: formSelectedTerritoryIds
      });
    }

    setIsDrawerOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe2 size={22} style={{ color: '#7C3AED' }} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Zone Management
            </h2>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Multi-territory governance zones with overlapping membership support across commercial corridors.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
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
          <span>Add Zone</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8'
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search zones by name, code, lead..."
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '36px',
              paddingRight: '12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <span style={{ fontSize: '13px', color: '#64748B' }}>
          <strong>{filteredZones.length}</strong> Zones Configured
        </span>
      </div>

      {/* Zone Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '18px'
        }}
      >
        {filteredZones.map((zone) => {
          const mappedTerritories = territories.filter((t) => zone.territoryIds.includes(t.id));

          return (
            <div
              key={zone.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: '#F3E8FF',
                        color: '#7C3AED',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Globe2 size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                        {zone.name}
                      </h3>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                        {zone.code}
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={zone.status} size="sm" />
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748B', lineHeight: 1.45 }}>
                  {zone.description}
                </p>

                {/* Lead & Budget */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Zonal Lead</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                      {zone.leadManager || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Annual Budget</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#7C3AED' }}>
                      ₹{((zone.annualBudget || 0) / 10000000).toFixed(2)} Crore
                    </div>
                  </div>
                </div>

                {/* Selected Territories Badges */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                      Mapped Territories ({mappedTerritories.length})
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#7C3AED', fontWeight: 600 }}>
                      Multi-zone allowed
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '72px', overflowY: 'auto' }}>
                    {mappedTerritories.map((t) => (
                      <span
                        key={t.id}
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #E2E8F0',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => toggleZoneStatus(zone.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: zone.status === 'Active' ? '#B91C1C' : '#047857',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Power size={13} />
                  <span>{zone.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(zone)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #DDD6FE',
                    backgroundColor: '#F5F3FF',
                    color: '#7C3AED',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Edit2 size={13} />
                  <span>Edit Zone</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(zone)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#B91C1C',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT ZONE MODAL */}
      <Modal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingZone ? `Edit Zone: ${editingZone.name}` : 'Configure New Zone'}
        subtitle="Group multiple territories across states into regional operational zones."
        maxWidth="lg"
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
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="zone-form"
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {editingZone ? 'Save Changes' : 'Create Zone'}
            </button>
          </>
        }
      >
        <form id="zone-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                Zone Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. South Strategic Zone"
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
                Zone Code *
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. ZONE-SOUTH"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Zonal Lead Director
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
                Annual Budget (₹)
              </label>
              <input
                type="number"
                step={5000000}
                value={formBudget}
                onChange={(e) => setFormBudget(Number(e.target.value))}
                placeholder="e.g. 150000000"
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
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Zone Description & Geographic Rationale
            </label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Outline regional strategic goals, mother warehouse coverage, and major hospital clusters..."
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

          {/* Hierarchical Territory Multi-Select */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                Select Member Territories ({formSelectedTerritoryIds.length} Selected)
              </label>
              <span style={{ fontSize: '11px', color: '#7C3AED' }}>
                Selecting a parent node automatically includes descendants
              </span>
            </div>
            <HierarchicalTreeSelect
              territories={territories}
              selectedIds={formSelectedTerritoryIds}
              onChange={setFormSelectedTerritoryIds}
              isMulti={true}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteZone(deleteTarget.id);
        }}
        title={`Delete Zone: ${deleteTarget?.name}?`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Member territories will remain intact.`}
        confirmLabel="Delete Zone"
        variant="danger"
      />
    </div>
  );
};
