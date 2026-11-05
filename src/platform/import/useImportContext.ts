import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { ImportContext } from './types';

export const useImportContext = (): ImportContext => {
  const app = useApp();
  return useMemo(() => ({
    actor: app.currentUser.name, products: app.products, productTypes: app.productTypes, portfolios: app.portfolios,
    industryPacks: app.industryPacks, attributeTemplates: app.attributeTemplates, warehouses: app.warehouses,
    importProducts: app.importProducts, revertProductImport: app.revertProductImport,
  }), [app]);
};
