import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext.tsx';
import type { Product } from '../../../types/product.ts';
import type { ProductScope } from '../types';

/**
 * Adapter over the EXISTING Product Master (AppContext.portfolios / products).
 * GTM V2 stores only IDs; names are always read live from the Product Master.
 *
 * INTEGRATION POINT: when Product Master moves to an API, only this hook changes.
 */
export const useProductMaster = () => {
  const { portfolios, products } = useApp();

  return useMemo(() => {
    const sellable = products.filter((p) => p.lifecycleStatus !== 'Retired');
    const categories = portfolios.flatMap((pf) => pf.categories.map((c) => ({ ...c, portfolioId: pf.id })));
    const subCategories = categories.flatMap((c) => c.subCategories.map((s) => ({ ...s, categoryId: c.id, portfolioId: c.portfolioId })));

    const productsInScope = (scope: ProductScope): Product[] => {
      if (scope.allProducts) return sellable;
      return sellable.filter((p) =>
        scope.productIds.includes(p.id)
        || scope.subCategoryIds.includes(p.subCategoryId)
        || scope.categoryIds.includes(p.categoryId)
        || scope.portfolioIds.includes(p.portfolioId));
    };

    const nameOf = (id: string): string =>
      portfolios.find((x) => x.id === id)?.name
      ?? categories.find((x) => x.id === id)?.name
      ?? subCategories.find((x) => x.id === id)?.name
      ?? products.find((x) => x.id === id)?.name
      ?? id;

    const describeScope = (scope: ProductScope): string => {
      if (scope.allProducts) return 'All products';
      const parts = [
        ...scope.portfolioIds.map(nameOf), ...scope.categoryIds.map(nameOf), ...scope.subCategoryIds.map(nameOf), ...scope.productIds.map(nameOf),
      ];
      if (!parts.length) return 'No products selected';
      return parts.length > 2 ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2}` : parts.join(', ');
    };

    return { portfolios, categories, subCategories, products: sellable, allProducts: products, productsInScope, describeScope, nameOf };
  }, [portfolios, products]);
};

export const useWarehouses = () => {
  const { warehouses } = useApp();
  return warehouses;
};
