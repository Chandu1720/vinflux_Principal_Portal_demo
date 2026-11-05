import React from 'react';
import { Alert } from '../../components/ui';
import { TerritoryTreePicker } from '../../components/domain/TerritoryPicker';
import { collapseSelection, territoryPath } from '../../utils/territory';
import type { StepProps } from './stepProps';

export const StepTerritories: React.FC<StepProps> = ({ state, update, data, config, showErrors }) => {
  const ids = state.input.territoryIds;
  const top = collapseSelection(ids, data.territories);
  return (
    <div className="g2-stack">
      <Alert tone="info">Territories drive which sales policies apply (next step) and which upstream / downstream partners are eligible. Hierarchy levels come from Territory Rules configuration.</Alert>
      {showErrors && !ids.length && <Alert tone="error">Select at least one territory.</Alert>}
      <TerritoryTreePicker
        territories={data.territories}
        levelLabels={config.territoryRules.levelLabels}
        values={ids}
        maxHeight={380}
        onChange={(v) => update((s) => ({ ...s, input: { ...s.input, territoryIds: v } }))}
      />
      {top.length > 0 && (
        <div className="g2-small">
          <div className="g2-label" style={{ marginBottom: 6 }}>Selected coverage</div>
          <div className="g2-row">{top.map((t) => <span key={t} className="g2-chip">{territoryPath(t, data.territories)}</span>)}</div>
        </div>
      )}
    </div>
  );
};
