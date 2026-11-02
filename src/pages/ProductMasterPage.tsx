import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import type { Product } from '../types/product.ts';

import { ProductList } from '../components/product/ProductList.tsx';
import { ProductDetail } from '../components/product/ProductDetail.tsx';
import { ProductFormDrawer } from '../components/product/ProductFormDrawer.tsx';
import { ConfigurationStudio } from '../components/product/ConfigurationStudio.tsx';

import { BarcodeLabelModal } from '../components/common/BarcodeLabel.tsx';
import { ImportModal } from '../components/product/ImportModal.tsx';
import { ExportModal } from '../components/product/ExportModal.tsx';
import { QuickConfigModal } from '../components/product/QuickConfigModal.tsx';

interface ProductMasterPageProps {
  searchTerm?: string;
}

export const ProductMasterPage: React.FC<ProductMasterPageProps> = ({ searchTerm = '' }) => {
  const { selectedProductId, setSelectedProductId } = useApp();

  // View state: 'list' | 'detail' | 'configuration'
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'configuration'>('list');
  const [configSection, setConfigSection] = useState<string>('productTypes');
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);

  // Modals state
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [quickConfigTarget, setQuickConfigTarget] = useState<string | null>(null);

  const handleViewProduct = (id: string) => {
    setSelectedProductId(id);
    setCurrentView('detail');
  };

  const handleEditProduct = (id: string) => {
    setEditProductId(id);
    setIsFormDrawerOpen(true);
  };

  const handleCreateProduct = () => {
    setEditProductId(null);
    setIsFormDrawerOpen(true);
  };

  const handleOpenConfigStudio = (section: string = 'productTypes') => {
    setConfigSection(section);
    setCurrentView('configuration');
  };

  return (
    <div>
      {currentView === 'list' && (
        <ProductList
          onViewProduct={handleViewProduct}
          onEditProduct={handleEditProduct}
          onCreateProduct={handleCreateProduct}
          onOpenConfigStudio={handleOpenConfigStudio}
          onPrintLabel={(p) => setBarcodeProduct(p)}
          onOpenImport={() => setImportOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          searchTerm={searchTerm}
        />
      )}

      {currentView === 'detail' && (
        <ProductDetail
          productId={selectedProductId}
          onBack={() => setCurrentView('list')}
          onEdit={handleEditProduct}
          onPrintLabel={(p) => setBarcodeProduct(p)}
        />
      )}

      {currentView === 'configuration' && (
        <ConfigurationStudio
          initialSection={configSection}
          onBack={() => setCurrentView('list')}
          onOpenQuickAdd={(target) => setQuickConfigTarget(target)}
        />
      )}

      {/* Product Create / Edit Side Drawer */}
      <ProductFormDrawer
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        editProductId={editProductId}
      />

      {/* Modals */}
      {barcodeProduct && (
        <BarcodeLabelModal
          product={barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
        />
      )}

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <QuickConfigModal
        target={quickConfigTarget || 'productTypes'}
        isOpen={Boolean(quickConfigTarget)}
        onClose={() => setQuickConfigTarget(null)}
      />
    </div>
  );
};
