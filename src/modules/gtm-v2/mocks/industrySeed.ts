/**
 * Go-to-Market starter data for the non-medical workspaces (agri, automotive, electronics):
 * industry channels and partner types, two sales policies, a small partner network with supply links,
 * licences and credit — so every Go-to-Market, pricing and order screen has something real to show.
 * Territories, zones, rules and approval workflows come from the common seed.
 */
import type { GtmDatabase, KycDocument, Partner, PartnerFlowMapping, PartnerType, SalesChannel, SalesFlow, SupplierLink, CustomerLink, ChannelTerms } from '../types';
import { linksCompat } from '../utils/supply';
import type { IndustryPackId } from '../../../types/product.ts';

const SYS = 'System Seed';
const stamp = (d: string, by = SYS) => ({ createdAt: d, createdBy: by, updatedAt: d, updatedBy: by });
const terms = (d: number, cp: number, cl: number, dep: number, mov: number): ChannelTerms => ({
  standardDiscountPct: d, creditPeriodDays: cp, creditLimit: cl, depositRequired: dep > 0, depositAmount: dep, minOrderValue: mov, maxOrderValue: null, effectiveFrom: '2026-01-01', effectiveTo: null,
});
const ch = (id: string, code: string, name: string, rank: number, endpoint: boolean, tm: ChannelTerms, description: string, tradeModel: 'RESELL' | 'AGENT' = 'RESELL'): SalesChannel => ({
  id, code, name, tierRank: rank, canBeEndpoint: endpoint, description, tradeModel, status: 'Active', version: 1, terms: tm,
  history: [{ version: 1, terms: tm, changedAt: '2026-01-01T09:00:00Z', changedBy: SYS, changeNote: 'Initial configuration' }], ...stamp('2026-01-01T09:00:00Z'),
});
const src = (wh: string | null) => ({ id: 's1', kind: 'SOURCE' as const, warehouseId: wh, channelId: null, label: 'Company Warehouse', allowMultiplePartners: false });
const stg = (id: string, channelId: string, label: string, multi = true) => ({ id, kind: 'CHANNEL' as const, channelId, warehouseId: null, label, allowMultiplePartners: multi });
const flow = (f: Omit<SalesFlow, 'history' | 'version' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>): SalesFlow => ({
  ...f, version: 1, ...stamp('2026-01-20T09:00:00Z'), history: [{ version: 1, changedAt: '2026-01-20T09:00:00Z', changedBy: SYS, note: 'Created', stageSummary: '' }],
});
const co = (wh: string | null = null): SupplierLink => ({ id: `sup-co-${wh ?? 'any'}`, kind: 'COMPANY', channelId: null, partnerId: null, warehouseId: wh, role: 'PRIMARY', portfolioIds: [] });
const sp = (partnerId: string, channelId: string): SupplierLink => ({ id: `sup-${partnerId}`, kind: 'PARTNER', channelId, partnerId, warehouseId: null, role: 'PRIMARY', portfolioIds: [] });

interface P { id: string; name: string; type: string; status: Partner['status']; ter: string[]; flows: string[]; city: string; state: string; pin: string; contact: string; credit?: [number, number]; licence?: string }
interface Spec {
  channels: SalesChannel[]; types: PartnerType[]; flows: SalesFlow[]; partners: P[];
  maps: { partnerId: string; flowId: string; self: string; sup: SupplierLink[]; cust: CustomerLink[] }[];
  gstState: Record<string, string>; licenceDoc: string | null; endpointTypes: string[];
}
const L = 100000;

const SPECS: Partial<Record<IndustryPackId, Spec>> = {
  agri: {
    channels: [
      ch('chn-cnf', 'CNF', 'C&F', 1, false, terms(2, 30, 8000000, 2000000, 400000), 'Carrying & forwarding agents holding company stock', 'AGENT'),
      ch('chn-dist', 'DIST', 'Distributor', 3, false, terms(8, 60, 4000000, 500000, 100000), 'District distributors of agri inputs (seasonal credit)'),
      ch('chn-dealer', 'DLR', 'Dealer', 4, false, terms(10, 45, 1000000, 100000, 20000), 'Mandal-level dealers'),
      ch('chn-retail', 'RTL', 'Agri Input Retailer', 5, true, terms(12, 30, 300000, 0, 5000), 'Village retailers selling to farmers'),
      ch('chn-fpo', 'FPO', 'FPO / Co-operative', 9, true, terms(9, 30, 1500000, 0, 25000), 'Farmer producer organisations and PACS buying for members'),
    ],
    types: [
      { id: 'pt-cnf', code: 'CNF', name: 'C&F Agent', description: 'Carrying & forwarding agent', channelId: 'chn-cnf', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-dist', code: 'DIST', name: 'Distributor', description: 'District distributor', channelId: 'chn-dist', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-dealer', code: 'DLR', name: 'Dealer', description: 'Mandal-level dealer', channelId: 'chn-dealer', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-retail', code: 'RTL', name: 'Agri Input Retailer', description: 'Village retailer', channelId: 'chn-retail', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-fpo', code: 'FPO', name: 'FPO / Co-operative', description: 'Farmer producer organisation / PACS', channelId: 'chn-fpo', status: 'Active', onboardingForm: 'full' },
    ],
    flows: [
      flow({ id: 'flow-agri-std', code: 'SF-AGR-01', name: 'Crop Protection & Seed — Dealer Network', description: 'Company → C&F → Distributor → Dealer → Retailer', status: 'Active', effectiveFrom: '2026-01-20', effectiveTo: null,
        stages: [src('wh-medc-06'), stg('s2', 'chn-cnf', 'C&F', false), stg('s3', 'chn-dist', 'Distributor'), stg('s4', 'chn-dealer', 'Dealer'), stg('s5', 'chn-retail', 'Retailer')],
        territoryIds: ['ter-ap', 'ter-ts'], zoneIds: [], productScope: { allProducts: false, portfolioIds: ['port-agri'], categoryIds: [], subCategoryIds: [], productIds: [] } }),
      flow({ id: 'flow-agri-fpo', code: 'SF-AGR-02', name: 'FPO Direct Supply', description: 'Company → FPO / Co-operative', status: 'Active', effectiveFrom: '2026-02-01', effectiveTo: null,
        stages: [src(null), stg('s2', 'chn-fpo', 'FPO / Co-operative')], territoryIds: ['ter-in'], zoneIds: [], productScope: { allProducts: true, portfolioIds: [], categoryIds: [], subCategoryIds: [], productIds: [] } }),
    ],
    partners: [
      { id: 'ptr-agr-cnf', name: 'Guntur Agri C&F Services', type: 'pt-cnf', status: 'Active', ter: ['ter-ap', 'ter-ts'], flows: ['flow-agri-std'], city: 'Guntur', state: 'Andhra Pradesh', pin: '522002', contact: 'K. Ramana', credit: [42 * L, 0] },
      { id: 'ptr-agr-dist', name: 'Sri Lakshmi Agro Agencies', type: 'pt-dist', status: 'Active', ter: ['ter-vja', 'ter-gnt'], flows: ['flow-agri-std'], city: 'Vijayawada', state: 'Andhra Pradesh', pin: '520001', contact: 'V. Srinivas', credit: [28 * L, 2.1 * L], licence: '2027-03-31' },
      { id: 'ptr-agr-dlr', name: 'Kisan Seva Kendra Tenali', type: 'pt-dealer', status: 'Active', ter: ['ter-gnt'], flows: ['flow-agri-std'], city: 'Tenali', state: 'Andhra Pradesh', pin: '522201', contact: 'P. Narayana', credit: [6.5 * L, 0], licence: '2026-11-30' },
      { id: 'ptr-agr-rtl', name: 'Raitu Mitra Fertilisers', type: 'pt-retail', status: 'Active', ter: ['ter-gnt'], flows: ['flow-agri-std'], city: 'Ponnur', state: 'Andhra Pradesh', pin: '522124', contact: 'B. Ravi', credit: [1.2 * L, 0], licence: '2027-06-30' },
      { id: 'ptr-agr-fpo', name: 'Krishna Delta Farmers Producer Co.', type: 'pt-fpo', status: 'Active', ter: ['ter-vja'], flows: ['flow-agri-fpo'], city: 'Machilipatnam', state: 'Andhra Pradesh', pin: '521001', contact: 'CEO — Krishna Delta FPC', credit: [3.8 * L, 0] },
      { id: 'ptr-agr-ka', name: 'Malnad Agri Distributors', type: 'pt-dist', status: 'KYC Under Review', ter: ['ter-ka'], flows: [], city: 'Shivamogga', state: 'Karnataka', pin: '577201', contact: 'H. Gowda' },
      { id: 'ptr-agr-draft', name: 'Annadata Agri Centre', type: 'pt-retail', status: 'Draft', ter: ['ter-wgl'], flows: [], city: 'Warangal', state: 'Telangana', pin: '506002', contact: 'S. Reddy' },
    ],
    maps: [
      { partnerId: 'ptr-agr-cnf', flowId: 'flow-agri-std', self: 'chn-cnf', sup: [co('wh-medc-06')], cust: [{ channelId: 'chn-dist', partnerIds: ['ptr-agr-dist'] }] },
      { partnerId: 'ptr-agr-dist', flowId: 'flow-agri-std', self: 'chn-dist', sup: [sp('ptr-agr-cnf', 'chn-cnf')], cust: [{ channelId: 'chn-dealer', partnerIds: ['ptr-agr-dlr'] }] },
      { partnerId: 'ptr-agr-dlr', flowId: 'flow-agri-std', self: 'chn-dealer', sup: [sp('ptr-agr-dist', 'chn-dist')], cust: [{ channelId: 'chn-retail', partnerIds: ['ptr-agr-rtl'] }] },
      { partnerId: 'ptr-agr-rtl', flowId: 'flow-agri-std', self: 'chn-retail', sup: [sp('ptr-agr-dlr', 'chn-dealer')], cust: [] },
      { partnerId: 'ptr-agr-fpo', flowId: 'flow-agri-fpo', self: 'chn-fpo', sup: [co()], cust: [] },
    ],
    gstState: { 'Andhra Pradesh': '37', Telangana: '36', Karnataka: '29' }, licenceDoc: 'kyc-ins', endpointTypes: ['pt-fpo'],
  },
  automotive: {
    channels: [
      ch('chn-cnf', 'CNF', 'C&F', 1, false, terms(2, 30, 6000000, 1500000, 300000), 'Carrying & forwarding agents holding company stock', 'AGENT'),
      ch('chn-dist', 'DIST', 'Spares Distributor', 3, false, terms(9, 45, 3000000, 500000, 75000), 'Regional aftermarket distributors'),
      ch('chn-retail', 'RTL', 'Spares Retailer', 5, true, terms(14, 30, 400000, 0, 10000), 'Auto spares shops'),
      ch('chn-workshop', 'WSP', 'Workshop / Garage', 6, true, terms(12, 15, 200000, 0, 5000), 'Independent workshops and multi-brand garages'),
      ch('chn-fleet', 'FLT', 'Fleet / Institutional', 9, true, terms(7, 45, 2000000, 0, 50000), 'Fleet operators, transport corporations, rental fleets'),
    ],
    types: [
      { id: 'pt-cnf', code: 'CNF', name: 'C&F Agent', description: 'Carrying & forwarding agent', channelId: 'chn-cnf', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-dist', code: 'DIST', name: 'Spares Distributor', description: 'Regional aftermarket distributor', channelId: 'chn-dist', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-retail', code: 'RTL', name: 'Spares Retailer', description: 'Auto spares shop', channelId: 'chn-retail', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-workshop', code: 'WSP', name: 'Workshop / Garage', description: 'Independent workshop', channelId: 'chn-workshop', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-fleet', code: 'FLT', name: 'Fleet Operator', description: 'Fleet / institutional buyer', channelId: 'chn-fleet', status: 'Active', onboardingForm: 'full' },
    ],
    flows: [
      flow({ id: 'flow-auto-std', code: 'SF-AUT-01', name: 'Aftermarket — Distributor to Retail & Workshops', description: 'Company → C&F → Distributor → Retailer / Workshop', status: 'Active', effectiveFrom: '2026-01-20', effectiveTo: null,
        stages: [src('wh-bhiw-01'), stg('s2', 'chn-cnf', 'C&F', false), stg('s3', 'chn-dist', 'Distributor'), stg('s4', 'chn-retail', 'Retailer'), stg('s5', 'chn-workshop', 'Workshop')],
        territoryIds: ['ter-mh', 'ter-ka'], zoneIds: [], productScope: { allProducts: false, portfolioIds: ['port-auto'], categoryIds: [], subCategoryIds: [], productIds: [] } }),
      flow({ id: 'flow-auto-fleet', code: 'SF-AUT-02', name: 'Fleet Direct', description: 'Company → Fleet operator', status: 'Active', effectiveFrom: '2026-02-01', effectiveTo: null,
        stages: [src(null), stg('s2', 'chn-fleet', 'Fleet')], territoryIds: ['ter-in'], zoneIds: [], productScope: { allProducts: true, portfolioIds: [], categoryIds: [], subCategoryIds: [], productIds: [] } }),
    ],
    partners: [
      { id: 'ptr-aut-cnf', name: 'Bhiwandi Auto C&F', type: 'pt-cnf', status: 'Active', ter: ['ter-mh'], flows: ['flow-auto-std'], city: 'Bhiwandi', state: 'Maharashtra', pin: '421302', contact: 'S. Patil', credit: [35 * L, 0] },
      { id: 'ptr-aut-dist', name: 'Pune Spares Distributors', type: 'pt-dist', status: 'Active', ter: ['ter-pune'], flows: ['flow-auto-std'], city: 'Pune', state: 'Maharashtra', pin: '411018', contact: 'R. Kulkarni', credit: [22 * L, 1.4 * L] },
      { id: 'ptr-aut-rtl', name: 'Chakan Auto Parts', type: 'pt-retail', status: 'Active', ter: ['ter-pune'], flows: ['flow-auto-std'], city: 'Chakan', state: 'Maharashtra', pin: '410501', contact: 'A. Shinde', credit: [2.4 * L, 0] },
      { id: 'ptr-aut-wsp', name: 'Sai Motors Multi-brand Workshop', type: 'pt-workshop', status: 'Active', ter: ['ter-pune'], flows: ['flow-auto-std'], city: 'Pune', state: 'Maharashtra', pin: '411014', contact: 'M. Jadhav', credit: [0.9 * L, 0] },
      { id: 'ptr-aut-fleet', name: 'Metro City Cabs Fleet', type: 'pt-fleet', status: 'Active', ter: ['ter-mum'], flows: ['flow-auto-fleet'], city: 'Mumbai', state: 'Maharashtra', pin: '400072', contact: 'Fleet Maintenance Head', credit: [11 * L, 0] },
      { id: 'ptr-aut-blr', name: 'Garden City Auto Spares', type: 'pt-dist', status: 'Approval Pending', ter: ['ter-blr'], flows: ['flow-auto-std'], city: 'Bengaluru', state: 'Karnataka', pin: '560058', contact: 'N. Rao' },
    ],
    maps: [
      { partnerId: 'ptr-aut-cnf', flowId: 'flow-auto-std', self: 'chn-cnf', sup: [co('wh-bhiw-01')], cust: [{ channelId: 'chn-dist', partnerIds: ['ptr-aut-dist'] }] },
      { partnerId: 'ptr-aut-dist', flowId: 'flow-auto-std', self: 'chn-dist', sup: [sp('ptr-aut-cnf', 'chn-cnf')], cust: [{ channelId: 'chn-retail', partnerIds: ['ptr-aut-rtl'] }, { channelId: 'chn-workshop', partnerIds: ['ptr-aut-wsp'] }] },
      { partnerId: 'ptr-aut-rtl', flowId: 'flow-auto-std', self: 'chn-retail', sup: [sp('ptr-aut-dist', 'chn-dist')], cust: [] },
      { partnerId: 'ptr-aut-wsp', flowId: 'flow-auto-std', self: 'chn-workshop', sup: [sp('ptr-aut-dist', 'chn-dist')], cust: [] },
      { partnerId: 'ptr-aut-fleet', flowId: 'flow-auto-fleet', self: 'chn-fleet', sup: [co()], cust: [] },
    ],
    gstState: { Maharashtra: '27', Karnataka: '29' }, licenceDoc: 'kyc-trade', endpointTypes: ['pt-workshop', 'pt-fleet'],
  },
  electronics: {
    channels: [
      ch('chn-cnf', 'CNF', 'C&F', 1, false, terms(2, 30, 9000000, 2500000, 500000), 'Carrying & forwarding agents holding company stock', 'AGENT'),
      ch('chn-ss', 'NDS', 'National Distributor', 2, false, terms(5, 45, 10000000, 2000000, 500000), 'National / regional distribution partners'),
      ch('chn-dist', 'DIST', 'Distributor', 3, false, terms(7, 30, 4000000, 500000, 100000), 'City distributors'),
      ch('chn-retail', 'RTL', 'Retailer', 5, true, terms(10, 15, 500000, 0, 10000), 'Multi-brand electronics stores'),
      ch('chn-mt', 'LFR', 'Modern Trade / LFR', 8, true, terms(14, 45, 6000000, 0, 200000), 'Large-format retail chains'),
      ch('chn-ecom', 'ECOM', 'E-commerce Marketplace', 9, true, terms(12, 30, 5000000, 0, 100000), 'Online marketplaces (seller fulfilment)'),
    ],
    types: [
      { id: 'pt-cnf', code: 'CNF', name: 'C&F Agent', description: 'Carrying & forwarding agent', channelId: 'chn-cnf', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-ss', code: 'NDS', name: 'National Distributor', description: 'National / regional distributor', channelId: 'chn-ss', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-dist', code: 'DIST', name: 'Distributor', description: 'City distributor', channelId: 'chn-dist', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-retail', code: 'RTL', name: 'Retailer', description: 'Multi-brand store', channelId: 'chn-retail', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-mt', code: 'LFR', name: 'Modern Trade Chain', description: 'Large-format retail chain', channelId: 'chn-mt', status: 'Active', onboardingForm: 'full' },
      { id: 'pt-ecom', code: 'ECOM', name: 'Marketplace Seller Account', description: 'E-commerce marketplace', channelId: 'chn-ecom', status: 'Active', onboardingForm: 'full' },
    ],
    flows: [
      flow({ id: 'flow-ele-std', code: 'SF-ELE-01', name: 'General Trade — Distributor to Retail', description: 'Company → C&F → National Distributor → Distributor → Retailer', status: 'Active', effectiveFrom: '2026-01-20', effectiveTo: null,
        stages: [src('wh-peen-04'), stg('s2', 'chn-cnf', 'C&F', false), stg('s3', 'chn-ss', 'National Distributor'), stg('s4', 'chn-dist', 'Distributor'), stg('s5', 'chn-retail', 'Retailer')],
        territoryIds: ['ter-ka', 'ter-tn'], zoneIds: [], productScope: { allProducts: false, portfolioIds: ['port-elec'], categoryIds: [], subCategoryIds: [], productIds: [] } }),
      flow({ id: 'flow-ele-key', code: 'SF-ELE-02', name: 'Key Accounts — Modern Trade & E-commerce', description: 'Company → LFR chain / marketplace', status: 'Active', effectiveFrom: '2026-02-01', effectiveTo: null,
        stages: [src('wh-peen-04'), stg('s2', 'chn-mt', 'Modern Trade')], territoryIds: ['ter-in'], zoneIds: [], productScope: { allProducts: true, portfolioIds: [], categoryIds: [], subCategoryIds: [], productIds: [] } }),
    ],
    partners: [
      { id: 'ptr-ele-cnf', name: 'Hosur Road C&F Logistics', type: 'pt-cnf', status: 'Active', ter: ['ter-ka', 'ter-tn'], flows: ['flow-ele-std'], city: 'Bengaluru', state: 'Karnataka', pin: '560068', contact: 'D. Kumar', credit: [55 * L, 0] },
      { id: 'ptr-ele-nds', name: 'Southern Electronics Distribution', type: 'pt-ss', status: 'Active', ter: ['ter-ka', 'ter-tn'], flows: ['flow-ele-std'], city: 'Bengaluru', state: 'Karnataka', pin: '560002', contact: 'A. Menon', credit: [72 * L, 0] },
      { id: 'ptr-ele-dist', name: 'Chennai Digital Distributors', type: 'pt-dist', status: 'Active', ter: ['ter-chn'], flows: ['flow-ele-std'], city: 'Chennai', state: 'Tamil Nadu', pin: '600017', contact: 'R. Senthil', credit: [18 * L, 3.2 * L] },
      { id: 'ptr-ele-rtl', name: 'Sri Ganesh Electronics', type: 'pt-retail', status: 'Active', ter: ['ter-chn'], flows: ['flow-ele-std'], city: 'Chennai', state: 'Tamil Nadu', pin: '600004', contact: 'G. Prakash', credit: [2.8 * L, 0] },
      { id: 'ptr-ele-mt', name: 'MegaMart Electronics (LFR)', type: 'pt-mt', status: 'Active', ter: ['ter-in'], flows: ['flow-ele-key'], city: 'Bengaluru', state: 'Karnataka', pin: '560095', contact: 'Category Manager — Appliances', credit: [48 * L, 0] },
      { id: 'ptr-ele-ecom', name: 'ShopNest Marketplace', type: 'pt-ecom', status: 'KYC Pending', ter: ['ter-in'], flows: [], city: 'Bengaluru', state: 'Karnataka', pin: '560103', contact: 'Seller Onboarding Team' },
    ],
    maps: [
      { partnerId: 'ptr-ele-cnf', flowId: 'flow-ele-std', self: 'chn-cnf', sup: [co('wh-peen-04')], cust: [{ channelId: 'chn-ss', partnerIds: ['ptr-ele-nds'] }] },
      { partnerId: 'ptr-ele-nds', flowId: 'flow-ele-std', self: 'chn-ss', sup: [sp('ptr-ele-cnf', 'chn-cnf')], cust: [{ channelId: 'chn-dist', partnerIds: ['ptr-ele-dist'] }] },
      { partnerId: 'ptr-ele-dist', flowId: 'flow-ele-std', self: 'chn-dist', sup: [sp('ptr-ele-nds', 'chn-ss')], cust: [{ channelId: 'chn-retail', partnerIds: ['ptr-ele-rtl'] }] },
      { partnerId: 'ptr-ele-rtl', flowId: 'flow-ele-std', self: 'chn-retail', sup: [sp('ptr-ele-dist', 'chn-dist')], cust: [] },
      { partnerId: 'ptr-ele-mt', flowId: 'flow-ele-key', self: 'chn-mt', sup: [co('wh-peen-04')], cust: [] },
    ],
    gstState: { Karnataka: '29', 'Tamil Nadu': '33' }, licenceDoc: 'kyc-trade', endpointTypes: ['pt-mt', 'pt-ecom'],
  },
};

/** Replace the medical channels / partner network of the common seed with this industry's. */
export const applyIndustrySeed = (ws: IndustryPackId, base: GtmDatabase): GtmDatabase => {
  const spec = SPECS[ws];
  if (!spec) return base;
  const typeIds = spec.types.map((x) => x.id);
  const kycDocs = base.config.kycDocuments.map((k) => ({
    ...k, mandatoryForPartnerTypeIds: ['kyc-gst', 'kyc-pan'].includes(k.id) ? typeIds : k.mandatoryForPartnerTypeIds.filter((t) => typeIds.includes(t)),
  }));
  const partners: Partner[] = spec.partners.map((p, i) => {
    const date = `2026-0${2 + (i % 6)}-1${i % 9}T10:00:00Z`;
    const verified = ['Active', 'Suspended', 'Approval Pending'].includes(p.status);
    const gs = spec.gstState[p.state] ?? '27';
    const pan = `AAB${'CFGHJ'[i % 5]}${String.fromCharCode(75 + i)}${String(4100 + i * 37).slice(0, 4)}${'KLMNP'[i % 5]}`;
    const docs: KycDocument[] = verified || p.status === 'KYC Under Review' ? [
      { id: `doc-${p.id}-1`, docTypeId: 'kyc-gst', fileName: 'GST_Certificate.pdf', fileSize: 245000, uploadedAt: date, status: verified ? 'Verified' : 'Under Review', remarks: '' },
      { id: `doc-${p.id}-2`, docTypeId: 'kyc-pan', fileName: 'PAN_Card.pdf', fileSize: 120000, uploadedAt: date, status: verified ? 'Verified' : 'Under Review', remarks: '' },
      // Every industry licence this partner type must hold (the first one carries the partner's own expiry date).
      ...kycDocs.filter((k) => !['kyc-gst', 'kyc-pan'].includes(k.id) && k.mandatoryForPartnerTypeIds.includes(p.type)).map((k, n) => ({
        id: `doc-${p.id}-${3 + n}`, docTypeId: k.id, fileName: `${k.name.replace(/[^A-Za-z]+/g, '_')}.pdf`, fileSize: 300000, uploadedAt: date,
        status: (verified ? 'Verified' : 'Under Review') as KycDocument['status'], remarks: '', documentNo: `LIC/${gs}/${4100 + i * 53 + n}`,
        validUntil: k.id === spec.licenceDoc ? (p.licence ?? '2028-03-31') : '2028-03-31',
      })),
    ] : [];
    return {
      id: p.id, code: `PTR-${String(i + 1).padStart(4, '0')}`, name: p.name, partnerTypeId: p.type, contactPerson: p.contact, email: `orders${i + 1}@${p.id.replace('ptr-', '')}.example`,
      phone: `+91 9${String(812300000 + i * 7919).slice(0, 9)}`, businessName: p.name, address: { line1: 'Main Road', city: p.city, state: p.state, pincode: p.pin },
      gst: `${gs}${pan}1Z${(i + 3) % 10}`, pan, kycStatus: verified ? 'Verified' : p.status === 'KYC Under Review' ? 'Under Review' : 'Pending', kycDocuments: docs,
      status: p.status, territoryIds: p.ter, flowIds: p.flows, submittedAt: p.status === 'Draft' ? null : date, activatedAt: p.status === 'Active' ? date : null, draftStep: p.status === 'Draft' ? 2 : 7,
      ...(p.credit ? { credit: { outstanding: p.credit[0], overdue: p.credit[1], asOf: '2026-11-04', hold: null } } : {}),
      ...stamp(date, 'Admin'),
    } as Partner;
  });
  const flows = spec.flows;
  const mappings: PartnerFlowMapping[] = spec.maps.map((m, i) => {
    const policy = flows.find((f) => f.id === m.flowId)!;
    return { id: `map-${m.partnerId}`, partnerId: m.partnerId, flowId: m.flowId, flowVersion: 1, status: 'Active', effectiveFrom: '2026-03-01', suppliers: m.sup, customers: m.cust,
      ...linksCompat(m.sup, m.cust, policy, m.self), ...stamp(`2026-03-0${1 + (i % 8)}T10:00:00Z`, 'Admin') } as PartnerFlowMapping;
  });
  return {
    ...base, channels: spec.channels, flows, partners, mappings, flowOverrides: [], terms: [], approvals: [], assignments: [], transfers: [],
    counters: { approval: 0, partner: partners.length, flow: flows.length },
    config: {
      ...base.config, partnerTypes: spec.types, kycDocuments: kycDocs,
      flowRules: { ...base.config.flowRules, blockedConnections: [] },
      portal: { ...base.config.portal, partnerTypeIds: typeIds },
    },
  };
};
