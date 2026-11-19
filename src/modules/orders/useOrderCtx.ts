import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels, useConfig, useFlows, useMappings, usePartners, useTerms, useTerritories } from '../gtm-v2/hooks/useGtmData';
import type { OrderCtx } from './orderStore';

/** Go-to-Market + Product Master data the order checks need (null while loading). */
export const useOrderCtx = (): OrderCtx | null => {
  const { products, warehouses } = useApp();
  const config = useConfig().data;
  const partners = usePartners().data;
  const channels = useChannels().data;
  const flows = useFlows().data;
  const mappings = useMappings().data;
  const terms = useTerms().data;
  const territories = useTerritories().data;
  return useMemo(() => (config && partners && channels && flows && mappings && terms && territories
    ? { products, config, partners, channels, flows, mappings, terms, territories, warehouses } : null),
  [products, warehouses, config, partners, channels, flows, mappings, terms, territories]);
};
