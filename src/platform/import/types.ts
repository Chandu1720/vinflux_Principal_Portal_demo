import type { ModuleId } from '../modules';
import type { AttributeDefinition, Product, ProductType, Portfolio, IndustryPack } from '../../types/product.ts';
import type { Warehouse } from '../../types/warehouse.ts';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  example: string;
  /** Other header names this column is recognised by (ERP export names). */
  aliases: string[];
  hint?: string;
}

export interface ImportOption { key: string; label: string; choices: { value: string; label: string }[]; default: string }

export interface ImportContext {
  actor: string;
  products: Product[];
  productTypes: ProductType[];
  portfolios: Portfolio[];
  industryPacks: IndustryPack[];
  attributeTemplates: Record<string, AttributeDefinition[]>;
  warehouses: Warehouse[];
  /** Channel partners (Go-to-Market) — for partner stock reports. */
  partners?: { id: string; name: string; code: string; partnerTypeId: string; status: string; institution?: unknown }[];
  importProducts: (created: Product[], updates: { id: string; patch: Partial<Product> }[]) => void;
  revertProductImport: (createdIds: string[], before: { id: string; values: Partial<Product> }[]) => void;
}

export type RowValues = Record<string, string>;

export interface RowResult {
  row: number;
  values: RowValues;
  errors: string[];
  warnings: string[];
  action: 'create' | 'update';
  /** Entity-specific resolved data used by apply(). */
  resolved?: unknown;
}

export interface ImportEntity {
  id: string;
  label: string;
  module: ModuleId;
  description: string;
  columns: ImportColumn[];
  options?: ImportOption[];
  validate: (rows: RowValues[], ctx: ImportContext, opts: Record<string, string>) => RowResult[];
  apply: (rows: RowResult[], ctx: ImportContext, opts: Record<string, string>, importId: string, source: string) => { refs: unknown; summary: string };
  undo: (refs: unknown, ctx: ImportContext, importId: string) => string;
}

export interface ImportBatch {
  id: string;
  entityId: string;
  entityLabel: string;
  fileName: string;
  source: string;
  at: string;
  by: string;
  counts: { total: number; created: number; updated: number; errors: number };
  summary: string;
  status: 'Imported' | 'Undone';
  refs: unknown;
  undoneAt?: string;
  undoneBy?: string;
}
