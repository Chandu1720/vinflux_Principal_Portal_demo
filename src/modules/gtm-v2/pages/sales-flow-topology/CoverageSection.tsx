import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info, Shapes } from 'lucide-react';
import type { Territory, TerritoryLevelLabel, Zone } from '../../types';
import { Alert, Badge, Field, MultiSelect, Segmented } from '../../components/ui';
import { TerritoryTreePicker } from '../../components/domain/TerritoryPicker';
import { expandWithDescendants } from '../../utils/territory';

/**
 * Coverage — zone first, then territories available in that zone.
 *
 * Storage stays unchanged (flow.zoneIds + flow.territoryIds):
 *  - "Entire zone"          → zone id in zoneIds (later changes to the zone flow through)
 *  - "Selected territories" → only the picked territories in territoryIds
 * Territories that sit outside every selected zone can still be added at the bottom.
 */
export const CoverageSection: React.FC<{
  zones: Zone[];
  territories: Territory[];
  levelLabels: TerritoryLevelLabel[];
  zoneIds: string[];
  territoryIds: string[];
  onChange: (next: { zoneIds: string[]; territoryIds: string[] }) => void;
  readOnly?: boolean;
}> = ({ zones, territories, levelLabels, zoneIds, territoryIds, onChange, readOnly }) => {
  const subtreeOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    zones.forEach((z) => m.set(z.id, expandWithDescendants(z.territoryIds, territories)));
    return m;
  }, [zones, territories]);

  // Zones picked in the UI = entire zones + zones whose territories were individually selected.
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(() => {
    const partial = zones.filter((z) => !zoneIds.includes(z.id) && territoryIds.some((t) => subtreeOf.get(z.id)?.has(t))).map((z) => z.id);
    return [...zoneIds, ...partial];
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selectedZoneIds.filter((id) => !zoneIds.includes(id))));
  const [showOther, setShowOther] = useState(false);

  const inSelectedZones = useMemo(() => {
    const s = new Set<string>();
    selectedZoneIds.forEach((id) => subtreeOf.get(id)?.forEach((t) => s.add(t)));
    return s;
  }, [selectedZoneIds, subtreeOf]);
  const otherTerritoryIds = territoryIds.filter((t) => !inSelectedZones.has(t));

  const changeZones = (next: string[]) => {
    const added = next.filter((id) => !selectedZoneIds.includes(id));
    const keepSubtrees = new Set<string>();
    next.forEach((id) => subtreeOf.get(id)?.forEach((t) => keepSubtrees.add(t)));
    // Territories picked inside a removed zone are dropped (unless still inside another selected zone)
    const removedTerr = new Set<string>();
    selectedZoneIds.filter((id) => !next.includes(id)).forEach((id) => subtreeOf.get(id)?.forEach((t) => { if (!keepSubtrees.has(t)) removedTerr.add(t); }));
    setSelectedZoneIds(next);
    onChange({
      zoneIds: [...zoneIds.filter((id) => next.includes(id)), ...added], // newly added zones default to "entire zone"
      territoryIds: territoryIds.filter((t) => !removedTerr.has(t)),
    });
  };

  const setMode = (zoneId: string, entire: boolean) => {
    const sub = subtreeOf.get(zoneId) ?? new Set<string>();
    if (entire) onChange({ zoneIds: [...new Set([...zoneIds, zoneId])], territoryIds: territoryIds.filter((t) => !sub.has(t)) });
    else {
      onChange({ zoneIds: zoneIds.filter((id) => id !== zoneId), territoryIds });
      setExpanded((s) => new Set(s).add(zoneId));
    }
  };

  const setZoneTerritories = (zoneId: string, picked: string[]) => {
    const sub = subtreeOf.get(zoneId) ?? new Set<string>();
    onChange({ zoneIds, territoryIds: [...territoryIds.filter((t) => !sub.has(t)), ...picked] });
  };

  const setOther = (picked: string[]) => {
    onChange({ zoneIds, territoryIds: [...territoryIds.filter((t) => inSelectedZones.has(t)), ...picked.filter((t) => !inSelectedZones.has(t))] });
  };

  const zoneOptions = zones.filter((z) => z.status === 'Active' || selectedZoneIds.includes(z.id))
    .map((z) => ({ value: z.id, label: z.name, description: `${z.code} · ${z.territoryIds.length} territor${z.territoryIds.length === 1 ? 'y' : 'ies'}` }));

  return (
    <div className="g2-stack" style={{ gap: 12 }}>
      <Field label="1. Zones" hint="Pick the zones this flow serves, then choose the entire zone or specific territories in it.">
        <MultiSelect values={selectedZoneIds} options={zoneOptions} onChange={changeZones} disabled={readOnly} placeholder="Select zones…" />
      </Field>

      {selectedZoneIds.length > 0 && <div className="g2-label">2. Territories in the selected zones</div>}
      {selectedZoneIds.map((zid) => {
        const zone = zones.find((z) => z.id === zid);
        if (!zone) return null;
        const sub = subtreeOf.get(zid) ?? new Set<string>();
        const entire = zoneIds.includes(zid);
        const picked = territoryIds.filter((t) => sub.has(t));
        const open = expanded.has(zid) && !entire;
        const zoneTerritories = territories.filter((t) => sub.has(t.id));
        return (
          <div key={zid} className="g2-form-section" style={{ padding: 12 }}>
            <div className="g2-row" style={{ gap: 8 }}>
              <button type="button" className="g2-tree-toggle" disabled={entire} aria-label="Toggle territories"
                onClick={() => setExpanded((s) => { const x = new Set(s); if (x.has(zid)) x.delete(zid); else x.add(zid); return x; })}>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <Shapes size={15} color="#6d28d9" />
              <strong>{zone.name}</strong>
              {zone.status === 'Inactive' && <Badge tone="slate">Inactive</Badge>}
              <span className="g2-spacer" />
              {!readOnly ? (
                <Segmented value={entire ? 'all' : 'some'} onChange={(v) => setMode(zid, v === 'all')}
                  options={[{ id: 'all', label: 'Entire zone' }, { id: 'some', label: 'Selected territories' }]} />
              ) : <Badge tone="purple">{entire ? 'Entire zone' : 'Selected territories'}</Badge>}
            </div>
            <div className="g2-small g2-muted" style={{ marginTop: 6, paddingLeft: 30 }}>
              {entire
                ? `All ${sub.size} territories in this zone are covered, including territories added to the zone later.`
                : picked.length ? `${picked.length} of ${sub.size} territories selected` : 'No territories selected yet — pick at least one, or switch to Entire zone.'}
            </div>
            {open && (
              <div style={{ marginTop: 10 }}>
                {readOnly ? (
                  <div className="g2-row">{picked.map((t) => <span key={t} className="g2-chip">{territories.find((x) => x.id === t)?.name ?? t}</span>)}</div>
                ) : (
                  <TerritoryTreePicker territories={zoneTerritories} allTerritories={territories} levelLabels={levelLabels} values={picked} onChange={(v) => setZoneTerritories(zid, v)} maxHeight={240} />
                )}
              </div>
            )}
            {!entire && !picked.length && !readOnly && !open && (
              <div style={{ marginTop: 8, paddingLeft: 30 }}><button type="button" className="g2-btn g2-btn-soft g2-btn-sm" onClick={() => setExpanded((s) => new Set(s).add(zid))}>Choose territories</button></div>
            )}
          </div>
        );
      })}

      <div>
        <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => setShowOther((s) => !s)}>
          {showOther ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Territories outside the selected zones {otherTerritoryIds.length > 0 && <Badge tone="purple">{otherTerritoryIds.length}</Badge>}
        </button>
        {showOther && (
          <div style={{ marginTop: 8 }}>
            <Alert icon={<Info size={15} />}>Use this for coverage not modelled as a zone (e.g. a whole country). Territories already inside a selected zone are hidden here.</Alert>
            <div style={{ marginTop: 8 }}>
              {readOnly ? (
                <div className="g2-row">{otherTerritoryIds.map((t) => <span key={t} className="g2-chip">{territories.find((x) => x.id === t)?.name ?? t}</span>)}{!otherTerritoryIds.length && <span className="g2-muted g2-small">None</span>}</div>
              ) : (
                <TerritoryTreePicker territories={territories.filter((t) => !inSelectedZones.has(t.id))} allTerritories={territories} levelLabels={levelLabels} values={otherTerritoryIds} onChange={setOther} maxHeight={240} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
