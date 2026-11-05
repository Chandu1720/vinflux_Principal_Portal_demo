import React, { useMemo, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import type { FlowStage, PartnerFlowMapping, SalesChannel, SalesFlow, FlowRules } from '../../types';
import { Alert, Button, Field, Modal, SearchableSelect } from '../../components/ui';
import { ChannelPathSelector } from '../sales-flow-topology/ChannelPathSelector';
import { flowService } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useWarehouses } from '../../hooks/useProductMaster';
import { validateFlowStages } from '../../utils/flow';

/**
 * Small "edit sales policy" drawer opened from onboarding when the needed partner type /
 * channel is not part of the sales policy yet. Only the sells-through / sells-to channels are edited.
 */
export const QuickFlowEditDrawer: React.FC<{
  open: boolean;
  flows: SalesFlow[];
  channels: SalesChannel[];
  mappings: PartnerFlowMapping[];
  rules: FlowRules;
  /** Channel the user is trying to enable (highlighted in the hint). */
  neededChannelId?: string | null;
  onClose: () => void;
}> = ({ open, flows, channels, mappings, rules, neededChannelId, onClose }) => {
  const warehouses = useWarehouses();
  const { actor, can } = useGtmAuth();
  const { run, pending } = useAction();
  const [flowId, setFlowId] = useState<string | null>(flows[0]?.id ?? null);
  const flow = flows.find((f) => f.id === flowId) ?? null;
  const [stages, setStages] = useState<FlowStage[]>(() => structuredClone(flows[0]?.stages ?? []));
  const issues = useMemo(() => validateFlowStages(stages, channels, rules), [stages, channels, rules]);
  const occupied = useMemo(() => new Set(mappings.filter((m) => m.flowId === flowId && m.status === 'Active').map((m) => m.ownStageId)), [mappings, flowId]);
  const needed = channels.find((c) => c.id === neededChannelId);
  const dirty = !!flow && JSON.stringify(flow.stages) !== JSON.stringify(stages);

  const pick = (id: string | null) => { setFlowId(id); setStages(structuredClone(flows.find((f) => f.id === id)?.stages ?? [])); };

  const save = async () => {
    if (!flow) return;
    const added = stages.filter((s) => s.channelId && !flow.stages.some((x) => x.channelId === s.channelId)).map((s) => channels.find((c) => c.id === s.channelId)?.name).filter(Boolean);
    const r = await run(() => flowService.update(flow.id, {
      code: flow.code, name: flow.name, description: flow.description, status: flow.status, effectiveFrom: flow.effectiveFrom, effectiveTo: flow.effectiveTo,
      stages, territoryIds: flow.territoryIds, zoneIds: flow.zoneIds, productScope: flow.productScope,
    }, `Edited from partner onboarding${added.length ? `: added ${added.join(', ')}` : ''}`, actor), `Sales policy "${flow.name}" updated.`);
    if (r) onClose();
  };

  return (
    <Modal open={open} size="lg" onClose={onClose} title="Edit sales policy" subtitle="Tick the channel to make that partner type available for this onboarding."
      footer={<><Button onClick={onClose}>Cancel</Button>{can.manageConfig && <Button variant="primary" loading={pending} disabled={!dirty || issues.some((i) => i.severity === 'error')} onClick={save}>Save sales policy</Button>}</>}>
      <div className="g2-stack">
        {!can.manageConfig && <Alert tone="warn" icon={<Lock size={15} />}>You need configuration rights to edit sales policies. Ask an admin to add the channel.</Alert>}
        {needed && <Alert icon={<Info size={15} />}>To onboard a <strong>{needed.name}</strong>, tick <strong>{needed.name}</strong> under {needed.canBeEndpoint ? 'Sells to' : 'Sells through'}.</Alert>}
        {flows.length > 1 && (
          <Field label="Sales policy" hint="Sales policies that sell the selected products in the selected territories">
            <SearchableSelect value={flowId} onChange={pick} options={flows.map((f) => ({ value: f.id, label: f.name, description: f.code }))} />
          </Field>
        )}
        {flow && (
          <ChannelPathSelector stages={stages} channels={channels} warehouses={warehouses} issues={issues} occupiedStageIds={occupied} readOnly={!can.manageConfig} onChange={setStages} />
        )}
        {dirty && <div className="g2-small g2-muted">Saving creates a new version of the sales policy; existing partner relationships are not changed.</div>}
      </div>
    </Modal>
  );
};
