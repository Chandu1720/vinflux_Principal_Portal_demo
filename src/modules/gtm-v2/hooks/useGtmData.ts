import { useQuery } from './useQuery';
import {
  approvalService, channelService, commercialService, configService, coverageService, flowService, partnerService, territoryService, zoneService,
} from '../services';

/* Named query hooks — one per resource. */
export const useTerritories = () => useQuery(territoryService.list, ['territories']);
export const useZones = () => useQuery(zoneService.list, ['zones']);
export const useChannels = () => useQuery(channelService.list, ['channels']);
export const useFlows = () => useQuery(flowService.list, ['flows']);
export const usePartners = () => useQuery(partnerService.list, ['partners']);
export const useMappings = () => useQuery(partnerService.listMappings, ['mappings', 'partners']);
export const useFlowOverrides = () => useQuery(partnerService.listFlowOverrides, ['partners', 'approvals']);
export const useTerms = () => useQuery(commercialService.list, ['terms', 'approvals']);
export const useApprovals = () => useQuery(approvalService.list, ['approvals', 'partners', 'terms']);
export const useConfig = () => useQuery(configService.get, ['config']);
export const useAssignments = () => useQuery(coverageService.list, ['assignments', 'approvals']);
export const useTransfers = () => useQuery(coverageService.listTransfers, ['transfers', 'approvals']);

/** Aggregate loader for pages that need several resources at once. */
export const useGtmBundle = () => {
  const territories = useTerritories();
  const zones = useZones();
  const channels = useChannels();
  const flows = useFlows();
  const partners = usePartners();
  const mappings = useMappings();
  const terms = useTerms();
  const approvals = useApprovals();
  const config = useConfig();
  const overrides = useFlowOverrides();
  const assignments = useAssignments();
  const transfers = useTransfers();
  const all = [territories, zones, channels, flows, partners, mappings, terms, approvals, config, overrides, assignments, transfers];
  const loading = all.some((q) => q.loading && q.data === undefined);
  const error = all.find((q) => q.error)?.error ?? null;
  return {
    loading,
    error,
    territories: territories.data ?? [],
    zones: zones.data ?? [],
    channels: channels.data ?? [],
    flows: flows.data ?? [],
    partners: partners.data ?? [],
    mappings: mappings.data ?? [],
    terms: terms.data ?? [],
    approvals: approvals.data ?? [],
    overrides: overrides.data ?? [],
    assignments: assignments.data ?? [],
    transfers: transfers.data ?? [],
    config: config.data,
  };
};
