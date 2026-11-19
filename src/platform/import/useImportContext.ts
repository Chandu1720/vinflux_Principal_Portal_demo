import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { ImportContext } from './types';
import { usePartners } from '../../modules/gtm-v2/hooks/useGtmData';

export const useImportContext = (): ImportContext => {
  const app = useApp();
  const partners = usePartners().data;
  return useMemo(() => ({
    partners: partners ?? [],
    actor: app.currentUser.name, products: app.products, productTypes: app.productTypes, portfolios: app.portfolios,
    industryPacks: app.industryPacks, attributeTemplates: app.attributeTemplates, warehouses: app.warehouses,
    importProducts: app.importProducts, revertProductImport: app.revertProductImport,
  }), [app, partners]);
};
