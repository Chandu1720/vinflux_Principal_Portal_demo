/**
 * GTM V2 mock seed data.
 * Used ONLY by the mock service layer (services/mockDb.ts). Pages never import this file.
 * Product IDs / portfolio IDs / warehouse IDs reference the EXISTING Product Master and
 * Warehouse Master seed data in src/data — nothing is duplicated here.
 */
import type {
  PortalUser,
  CustomerAssignment,
  InstitutionDetails,
  ApprovalRequest,
  ChannelTerms,
  CommercialTermRecord,
  GtmConfiguration,
  GtmDatabase,
  Partner,
  PartnerFlowMapping,
  SalesChannel,
  SalesFlow,
  Territory,
  Zone,
  SupplierLink,
  CustomerLink,
} from '../types';
import { linksCompat } from '../utils/supply';

export const SCHEMA_VERSION = 8; // v8: short-form partner types, hospital coverage

const SYS = 'System Seed';
/** Medical Devices Rules 2017 (as amended): sellers and stockists need a sale / distribution registration (application MD-41, certificate MD-42). */
export const MD42_NAME = 'Medical Device Sale Registration (MD-42)';
export const MD42_DESC = 'Registration to sell, stock or distribute medical devices — required for every reseller and stockist';

const stamp = (d: string, by = SYS) => ({ createdAt: d, createdBy: by, updatedAt: d, updatedBy: by });

/* ----------------------------- Territories ----------------------------- */
const t = (id: string, code: string, name: string, parentId: string | null, description = '', status: 'Active' | 'Inactive' = 'Active'): Territory => ({
  id, code, name, parentId, description, status, ...stamp('2026-01-05T09:00:00Z'),
});

const territories: Territory[] = [
  t('ter-in', 'IN', 'India', null, 'National market'),
  t('ter-ap', 'IN-AP', 'Andhra Pradesh', 'ter-in'),
  t('ter-ap-coastal', 'AP-CST', 'Coastal Andhra', 'ter-ap'),
  t('ter-vja', 'AP-VJA', 'Vijayawada', 'ter-ap-coastal'),
  t('ter-vja-benz', 'VJA-BNZ', 'Benz Circle', 'ter-vja', 'Hospital cluster around Benz Circle'),
  t('ter-vja-gov', 'VJA-GVP', 'Governorpet', 'ter-vja'),
  t('ter-gnt', 'AP-GNT', 'Guntur', 'ter-ap-coastal'),
  t('ter-vsp', 'AP-VSP', 'Visakhapatnam', 'ter-ap-coastal'),
  t('ter-ap-rys', 'AP-RYS', 'Rayalaseema', 'ter-ap'),
  t('ter-tpt', 'AP-TPT', 'Tirupati', 'ter-ap-rys'),
  t('ter-ts', 'IN-TS', 'Telangana', 'ter-in'),
  t('ter-hyd', 'TS-HYD', 'Hyderabad Metro', 'ter-ts'),
  t('ter-sec', 'HYD-SEC', 'Secunderabad', 'ter-hyd'),
  t('ter-wgl', 'TS-WGL', 'Warangal', 'ter-ts'),
  t('ter-ka', 'IN-KA', 'Karnataka', 'ter-in'),
  t('ter-blr', 'KA-BLR', 'Bengaluru Urban', 'ter-ka'),
  t('ter-mys', 'KA-MYS', 'Mysuru', 'ter-ka'),
  t('ter-tn', 'IN-TN', 'Tamil Nadu', 'ter-in'),
  t('ter-chn', 'TN-CHN', 'Chennai', 'ter-tn'),
  t('ter-mh', 'IN-MH', 'Maharashtra', 'ter-in'),
  t('ter-mum', 'MH-MUM', 'Mumbai Metro', 'ter-mh'),
  t('ter-pune', 'MH-PNQ', 'Pune', 'ter-mh'),
  t('ter-ngp', 'MH-NGP', 'Nagpur', 'ter-mh', 'Pending commercial launch', 'Inactive'),
];

/* ------------------------------- Zones -------------------------------- */
const zones: Zone[] = [
  { id: 'zone-south', code: 'ZN-SOUTH', name: 'South Zone', description: 'Southern states commercial zone', status: 'Active', territoryIds: ['ter-ap', 'ter-ts', 'ter-ka', 'ter-tn'], ...stamp('2026-01-10T09:00:00Z') },
  { id: 'zone-west', code: 'ZN-WEST', name: 'West Zone', description: 'Western region', status: 'Active', territoryIds: ['ter-mh', 'ter-mum', 'ter-pune'], ...stamp('2026-01-10T09:00:00Z') },
  { id: 'zone-metro', code: 'ZN-METRO', name: 'Metro Key Accounts', description: 'Tier-1 metro hospital clusters (overlaps other zones)', status: 'Active', territoryIds: ['ter-hyd', 'ter-blr', 'ter-chn', 'ter-mum'], ...stamp('2026-01-12T09:00:00Z') },
  { id: 'zone-ap-coastal', code: 'ZN-APC', name: 'AP Coastal Belt', description: 'Coastal Andhra focus zone', status: 'Active', territoryIds: ['ter-vja', 'ter-gnt', 'ter-vsp'], ...stamp('2026-02-01T09:00:00Z') },
];

/* ---------------------------- Sales Channels ---------------------------- */
const terms = (d: number, cp: number, cl: number, dep: number, mov: number, max: number | null): ChannelTerms => ({
  standardDiscountPct: d, creditPeriodDays: cp, creditLimit: cl,
  depositRequired: dep > 0, depositAmount: dep,
  minOrderValue: mov, maxOrderValue: max,
  effectiveFrom: '2026-01-01', effectiveTo: null,
});

const ch = (id: string, code: string, name: string, rank: number, endpoint: boolean, tm: ChannelTerms, description: string, tradeModel: 'RESELL' | 'AGENT' = 'RESELL'): SalesChannel => ({
  id, code, name, tierRank: rank, canBeEndpoint: endpoint, description, tradeModel, status: 'Active', version: 1, terms: tm,
  history: [{ version: 1, terms: tm, changedAt: '2026-01-01T09:00:00Z', changedBy: SYS, changeNote: 'Initial configuration' }],
  ...stamp('2026-01-01T09:00:00Z'),
});

const channels: SalesChannel[] = [
  ch('chn-cnf', 'CNF', 'C&F', 1, false, terms(2, 30, 10000000, 2500000, 500000, null), 'Carrying & forwarding agents holding company stock', 'AGENT'),
  ch('chn-ss', 'SS', 'Super Stockist', 2, false, terms(6, 45, 7500000, 1500000, 300000, null), 'Regional aggregators feeding distributors'),
  ch('chn-dist', 'DIST', 'Distributor', 3, false, terms(8, 45, 5000000, 1000000, 100000, 5000000), 'Authorised distributors'),
  ch('chn-dealer', 'DLR', 'Dealer', 4, false, terms(10, 30, 1500000, 250000, 25000, 1500000), 'Sub-distribution dealers'),
  ch('chn-retail', 'RTL', 'Retailer', 5, true, terms(12, 15, 300000, 0, 5000, 300000), 'Retail outlets / surgical stores'),
  ch('chn-hosp', 'HOSP', 'Hospital Direct', 9, true, terms(5, 60, 2500000, 0, 50000, null), 'Hospitals & institutions as end customers'),
  ch('chn-direct', 'DSL', 'Direct Sales', 9, true, terms(0, 0, 0, 0, 0, null), 'Company direct sales to end customers'),
];

/* ------------------------------ Sales Flows ----------------------------- */
const src = (id: string, wh: string | null = null) => ({ id, kind: 'SOURCE' as const, warehouseId: wh, channelId: null, label: 'Company Warehouse', allowMultiplePartners: false });
const stg = (id: string, channelId: string, label: string, multi = true) => ({ id, kind: 'CHANNEL' as const, channelId, warehouseId: null, label, allowMultiplePartners: multi });
const scope = (p: string[] = [], all = false) => ({ allProducts: all, portfolioIds: p, categoryIds: [], subCategoryIds: [], productIds: [] });
const flow = (f: Omit<SalesFlow, 'history' | 'version' | keyof ReturnType<typeof stamp>>): SalesFlow => ({
  ...f, version: 1, ...stamp('2026-01-20T09:00:00Z'),
  history: [{ version: 1, changedAt: '2026-01-20T09:00:00Z', changedBy: SYS, note: 'Created', stageSummary: '' }],
});

const flows: SalesFlow[] = [
  flow({ id: 'flow-std', code: 'SF-STD-01', name: 'Standard Multi-tier Hospital Flow', description: 'Sells through C&F, Super Stockist, Distributor and Dealer to hospitals', status: 'Active', effectiveFrom: '2026-01-20', effectiveTo: null,
    stages: [src('s1', 'wh-medc-06'), stg('s2', 'chn-cnf', 'C&F', false), stg('s2b', 'chn-ss', 'Super Stockist'), stg('s3', 'chn-dist', 'Distributor'), stg('s4', 'chn-dealer', 'Dealer'), stg('s5', 'chn-hosp', 'Hospital')],
    territoryIds: ['ter-ap', 'ter-ts'], zoneIds: [], productScope: scope(['port-arthro', 'port-trauma']) }),
  flow({ id: 'flow-direct', code: 'SF-DIR-01', name: 'Direct Hospital Supply', description: 'Company Warehouse → Hospital', status: 'Active', effectiveFrom: '2026-01-20', effectiveTo: null,
    stages: [src('s1'), stg('s2', 'chn-hosp', 'Hospital')],
    territoryIds: ['ter-in'], zoneIds: ['zone-metro'], productScope: scope([], true) }),
  flow({ id: 'flow-regional', code: 'SF-REG-01', name: 'Regional Distributor Flow', description: 'Company Warehouse → Regional Distributor → Hospital', status: 'Active', effectiveFrom: '2026-02-01', effectiveTo: null,
    stages: [src('s1', 'wh-peen-04'), stg('s2', 'chn-dist', 'Regional Distributor'), stg('s3', 'chn-hosp', 'Hospital')],
    territoryIds: ['ter-ka', 'ter-tn'], zoneIds: [], productScope: scope(['port-robotics', 'port-arthro']) }),
  flow({ id: 'flow-west-ss', code: 'SF-WST-01', name: 'West Super Stockist Retail Flow', description: 'Warehouse → C&F → Super Stockist → Distributor → Retailer', status: 'Active', effectiveFrom: '2026-02-15', effectiveTo: null,
    stages: [src('s1', 'wh-bhiw-01'), stg('s2', 'chn-cnf', 'C&F', false), stg('s3', 'chn-ss', 'Super Stockist'), stg('s4', 'chn-dist', 'Distributor'), stg('s5', 'chn-retail', 'Retailer')],
    territoryIds: [], zoneIds: ['zone-west'], productScope: scope(['port-consumables']) }),
  flow({ id: 'flow-ap-retail', code: 'SF-APR-01', name: 'AP Consumables Retail (Pilot)', description: 'Draft pilot flow for coastal retail', status: 'Draft', effectiveFrom: '2026-12-01', effectiveTo: null,
    stages: [src('s1', 'wh-medc-06'), stg('s2', 'chn-dist', 'Distributor'), stg('s3', 'chn-dealer', 'Dealer'), stg('s4', 'chn-retail', 'Retailer')],
    territoryIds: [], zoneIds: ['zone-ap-coastal'], productScope: scope(['port-consumables']) }),
];

/* ------------------------------- Partners ------------------------------- */
let pSeq = 0;
const partner = (p: Partial<Partner> & Pick<Partner, 'id' | 'name' | 'partnerTypeId' | 'status' | 'territoryIds' | 'flowIds'>, date: string): Partner => {
  pSeq += 1;
  const verified = ['Active', 'Suspended', 'Approval Pending'].includes(p.status);
  return {
    code: `PTR-${String(pSeq).padStart(4, '0')}`,
    contactPerson: 'Partner Contact',
    email: `contact${pSeq}@partner.example`,
    phone: `+91 98${String(48000000 + pSeq * 7919).slice(0, 8)}`,
    businessName: p.name,
    address: { line1: 'Business District', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    gst: `36ABCDE${String(1000 + pSeq)}F1Z${pSeq % 10}`,
    pan: `ABCDE${String(1000 + pSeq)}F`,
    kycStatus: verified ? 'Verified' : p.status === 'KYC Under Review' ? 'Under Review' : p.status === 'Rejected' ? 'Rejected' : 'Pending',
    kycDocuments: verified || p.status === 'KYC Under Review' ? [
      { id: `doc-${pSeq}-1`, docTypeId: 'kyc-gst', fileName: 'GST_Certificate.pdf', fileSize: 245000, uploadedAt: date, status: verified ? 'Verified' : 'Under Review', remarks: '' },
      { id: `doc-${pSeq}-2`, docTypeId: 'kyc-pan', fileName: 'PAN_Card.pdf', fileSize: 120000, uploadedAt: date, status: verified ? 'Verified' : 'Under Review', remarks: '' },
      { id: `doc-${pSeq}-3`, docTypeId: 'kyc-dl', fileName: 'MD42_Sale_Registration.pdf', fileSize: 380000, uploadedAt: date, status: verified ? 'Verified' : 'Under Review', remarks: '', documentNo: `MD-42/TS/${String(4100 + pSeq * 37)}/2024`, validUntil: '2028-03-31' },
    ] : [],
    submittedAt: p.status === 'Draft' ? null : date,
    activatedAt: p.status === 'Active' ? date : null,
    draftStep: p.status === 'Draft' ? 3 : 7,
    ...stamp(date, 'Dr. Arvind Rao'),
    ...p,
  } as Partner;
};

const partners: Partner[] = [
  partner({ id: 'ptr-cnf-hyd', name: 'Deccan C&F Logistics', partnerTypeId: 'pt-cnf', status: 'Active', territoryIds: ['ter-ts', 'ter-ap'], flowIds: ['flow-std'], contactPerson: 'Ramesh Goud' }, '2026-02-02T10:00:00Z'),
  partner({ id: 'ptr-dist-vja', name: 'Krishna Medi Distributors', partnerTypeId: 'pt-dist', status: 'Active', territoryIds: ['ter-vja', 'ter-gnt'], flowIds: ['flow-std'], contactPerson: 'Srinivas Rao', address: { line1: 'MG Road', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520010' } }, '2026-02-10T10:00:00Z'),
  partner({ id: 'ptr-dist-hyd', name: 'Charminar Surgicals Pvt Ltd', partnerTypeId: 'pt-dist', status: 'Active', territoryIds: ['ter-hyd'], flowIds: ['flow-std'], contactPerson: 'Imran Khan' }, '2026-02-14T10:00:00Z'),
  partner({ id: 'ptr-dlr-benz', name: 'Benz Circle Ortho Dealers', partnerTypeId: 'pt-dealer', status: 'Active', territoryIds: ['ter-vja-benz'], flowIds: ['flow-std'], contactPerson: 'Lakshmi Prasad', address: { line1: 'Benz Circle', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520008' } }, '2026-03-01T10:00:00Z'),
  partner({ id: 'ptr-hosp-vja', name: 'Ramesh Hospitals Vijayawada', partnerTypeId: 'pt-hosp', status: 'Active', territoryIds: ['ter-vja-benz'], flowIds: ['flow-std', 'flow-direct'], contactPerson: 'Dr. K. Mohan', address: { line1: 'Ring Road', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520008' } }, '2026-03-05T10:00:00Z'),
  partner({ id: 'ptr-hosp-hyd', name: 'Yashoda Hospitals Somajiguda', partnerTypeId: 'pt-hosp', status: 'Active', territoryIds: ['ter-sec'], flowIds: ['flow-direct'], contactPerson: 'Procurement Head', address: { line1: 'Raj Bhavan Road', city: 'Hyderabad', state: 'Telangana', pincode: '500082' } }, '2026-03-12T10:00:00Z'),
  partner({ id: 'ptr-dist-blr', name: 'Garden City Meditech', partnerTypeId: 'pt-dist', status: 'Active', territoryIds: ['ter-blr', 'ter-mys'], flowIds: ['flow-regional'], contactPerson: 'Anand Shetty', address: { line1: 'Whitefield', city: 'Bengaluru', state: 'Karnataka', pincode: '560066' } }, '2026-04-02T10:00:00Z'),
  partner({ id: 'ptr-hosp-blr', name: 'Narayana Health City Bengaluru', partnerTypeId: 'pt-hosp', status: 'Active', territoryIds: ['ter-blr'], flowIds: ['flow-regional'], contactPerson: 'Materials Manager', address: { line1: 'Bommasandra', city: 'Bengaluru', state: 'Karnataka', pincode: '560099' } }, '2026-04-10T10:00:00Z'),
  partner({ id: 'ptr-cnf-mum', name: 'Bhiwandi C&F Services', partnerTypeId: 'pt-cnf', status: 'Active', territoryIds: ['ter-mh'], flowIds: ['flow-west-ss'], contactPerson: 'Sunil Patil', address: { line1: 'Vashere', city: 'Bhiwandi', state: 'Maharashtra', pincode: '421302' } }, '2026-04-15T10:00:00Z'),
  partner({ id: 'ptr-ss-pune', name: 'Sahyadri Super Stockist', partnerTypeId: 'pt-ss', status: 'Suspended', territoryIds: ['ter-pune'], flowIds: ['flow-west-ss'], contactPerson: 'Vivek Joshi' }, '2026-05-02T10:00:00Z'),
  partner({ id: 'ptr-dlr-gnt', name: 'Guntur Surgical House', partnerTypeId: 'pt-dealer', status: 'Approval Pending', territoryIds: ['ter-gnt'], flowIds: ['flow-std'], contactPerson: 'P. Venkatesh' }, '2026-10-20T10:00:00Z'),
  partner({ id: 'ptr-dist-chn', name: 'Marina Health Distributors', partnerTypeId: 'pt-dist', status: 'KYC Under Review', territoryIds: ['ter-chn'], flowIds: ['flow-regional'], contactPerson: 'S. Karthik' }, '2026-10-26T10:00:00Z'),
  partner({ id: 'ptr-rtl-mum', name: 'Andheri Surgical Mart', partnerTypeId: 'pt-retail', status: 'KYC Pending', territoryIds: ['ter-mum'], flowIds: [], contactPerson: 'Neha Shah' }, '2026-10-29T10:00:00Z'),
  partner({ id: 'ptr-dlr-tpt', name: 'Tirupati Ortho Agencies', partnerTypeId: 'pt-dealer', status: 'Draft', territoryIds: ['ter-tpt'], flowIds: [], contactPerson: 'M. Reddy' }, '2026-11-01T10:00:00Z'),
  partner({ id: 'ptr-dist-wgl', name: 'Kakatiya Pharma Links', partnerTypeId: 'pt-dist', status: 'Rejected', territoryIds: ['ter-wgl'], flowIds: [], contactPerson: 'R. Naidu' }, '2026-09-14T10:00:00Z'),
  partner({ id: 'ptr-hosp-sec', name: 'Yashoda Hospitals Secunderabad', partnerTypeId: 'pt-hosp', status: 'Active', territoryIds: ['ter-sec'], flowIds: [], contactPerson: 'Purchase Manager', address: { line1: 'Alexander Road', city: 'Secunderabad', state: 'Telangana', pincode: '500003' } }, '2026-04-28T10:00:00Z'),
  partner({ id: 'ptr-ss-chandu', name: 'Chandu Super Stockist', partnerTypeId: 'pt-ss', status: 'Active', territoryIds: ['ter-ap', 'ter-ts'], flowIds: ['flow-std'], contactPerson: 'Chandu K', address: { line1: 'Eluru Road', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520002' } }, '2026-02-05T10:00:00Z'),
];

/* Day-2 demo data: receivables (normally from the ERP ledger), licence validity, portal users. */
const L = 100000;
const CREDIT: Record<string, [number, number, { reason: string; heldBy: string; heldAt: string } | null]> = {
  'ptr-cnf-hyd': [64 * L, 0, null],
  'ptr-ss-chandu': [66 * L, 0, null],
  'ptr-dist-vja': [52 * L, 0, null],
  'ptr-dist-hyd': [31 * L, 0, null],
  'ptr-dlr-benz': [9.8 * L, 0, null],
  'ptr-hosp-vja': [4.2 * L, 0, null],
  'ptr-hosp-hyd': [18 * L, 0, null],
  'ptr-dist-blr': [47 * L, 3.4 * L, null],
  'ptr-hosp-blr': [6 * L, 0, null],
  'ptr-cnf-mum': [82 * L, 12.5 * L, { reason: 'Cheque bounce on 18 Oct 2026 (₹12.5 L)', heldBy: 'Finance Controller', heldAt: '2026-10-19T11:30:00Z' }],
};
const LICENCE_UNTIL: Record<string, string> = { 'ptr-dist-hyd': '2026-11-22', 'ptr-dlr-benz': '2026-10-28', 'ptr-ss-chandu': '2026-12-01' };
const pu = (name: string, email: string, role: PortalUser['role'], status: PortalUser['status'], invitedAt: string, expiresAt?: string): PortalUser => ({
  id: `pu-${email}`, name, email, phone: '', role, status, invitedAt, invitedBy: 'Dr. Arvind Rao', lastSentAt: invitedAt,
  expiresAt: expiresAt ?? new Date(new Date(invitedAt).getTime() + 7 * 86400000).toISOString(), acceptedAt: status === 'Active' ? invitedAt : null,
});
const PORTAL: Record<string, PortalUser[]> = {
  'ptr-cnf-hyd': [pu('Ramesh Goud', 'ramesh@deccancf.example', 'Owner', 'Active', '2026-02-03T10:00:00Z'), pu('Accounts Desk', 'accounts@deccancf.example', 'Accounts', 'Active', '2026-02-04T10:00:00Z')],
  'ptr-dist-vja': [pu('Srinivas Rao', 'srinivas@krishnamedi.example', 'Owner', 'Active', '2026-02-11T10:00:00Z'), pu('Order Desk', 'orders@krishnamedi.example', 'Ordering', 'Invited', '2026-11-03T10:00:00Z', '2026-11-10T10:00:00Z')],
  'ptr-ss-chandu': [pu('Chandu K', 'chandu@chanduss.example', 'Owner', 'Active', '2026-02-06T10:00:00Z')],
  'ptr-dist-hyd': [pu('Imran Khan', 'imran@charminar.example', 'Owner', 'Invited', '2026-10-13T10:00:00Z', '2026-10-20T10:00:00Z')],
  'ptr-dlr-benz': [pu('Lakshmi Prasad', 'lakshmi@benzortho.example', 'Owner', 'Active', '2026-03-02T10:00:00Z')],
};
const INSTITUTION: Record<string, InstitutionDetails> = {
  'ptr-hosp-vja': { institutionType: 'Multi-speciality Hospital', ownership: 'Private', bedCount: 350, registrationNo: 'AP-CE-2019-0412', drugLicenseNo: '', procurementContact: 'Materials dept · 0866-2470000', hospitalGroup: 'Ramesh Hospitals' },
  'ptr-hosp-hyd': { institutionType: 'Multi-speciality Hospital', ownership: 'Corporate Chain', bedCount: 500, registrationNo: 'TS-CE-2015-0098', drugLicenseNo: '', procurementContact: 'Central procurement · 040-45670000', hospitalGroup: 'Yashoda Hospitals' },
  'ptr-hosp-sec': { institutionType: 'Multi-speciality Hospital', ownership: 'Corporate Chain', bedCount: 420, registrationNo: 'TS-CE-2016-0133', drugLicenseNo: '', procurementContact: 'Central procurement · 040-45670000', hospitalGroup: 'Yashoda Hospitals' },
  'ptr-hosp-blr': { institutionType: 'Multi-speciality Hospital', ownership: 'Corporate Chain', bedCount: 600, registrationNo: 'KA-CE-2014-0211', drugLicenseNo: '', procurementContact: 'Supply chain · 080-71222222', hospitalGroup: 'Narayana Health' },
};
partners.forEach((p) => {
  if (INSTITUTION[p.id]) p.institution = INSTITUTION[p.id];
  const c = CREDIT[p.id];
  if (c) p.credit = { outstanding: c[0], overdue: c[1], asOf: '2026-11-04', hold: c[2] && { ...c[2], releaseRequestId: null } };
  const dl = p.kycDocuments.find((d) => d.docTypeId === 'kyc-dl');
  if (dl && LICENCE_UNTIL[p.id]) dl.validUntil = LICENCE_UNTIL[p.id];
  if (PORTAL[p.id]) p.portalUsers = PORTAL[p.id];
});

/* --------------------------- Partner mappings --------------------------- */
// Neighbours-only: each partner records ONLY its own suppliers and direct customers.
const co = (warehouseId: string | null = null): SupplierLink => ({ id: `sup-co-${warehouseId ?? 'any'}`, kind: 'COMPANY', channelId: null, partnerId: null, warehouseId, role: 'PRIMARY', portfolioIds: [] });
const sp = (partnerId: string, channelId: string, role: SupplierLink['role'] = 'PRIMARY', portfolioIds: string[] = []): SupplierLink => ({ id: `sup-${partnerId}-${role}-${portfolioIds.join('_') || 'all'}`, kind: 'PARTNER', channelId, partnerId, warehouseId: null, role, portfolioIds });
const map = (id: string, partnerId: string, flowId: string, selfChannelId: string, suppliers: SupplierLink[], customers: CustomerLink[], date = '2026-03-10T10:00:00Z'): PartnerFlowMapping => {
  const policy = flows.find((f) => f.id === flowId)!;
  return {
    id, partnerId, flowId, flowVersion: 1, status: 'Active', effectiveFrom: date.slice(0, 10), suppliers, customers,
    ...linksCompat(suppliers, customers, policy, selfChannelId),
    ...stamp(date, 'Dr. Arvind Rao'),
  };
};

const mappings: PartnerFlowMapping[] = [
  map('map-cnf-hyd', 'ptr-cnf-hyd', 'flow-std', 'chn-cnf', [co('wh-medc-06')], [], '2026-02-02T10:00:00Z'),
  map('map-ss-chandu', 'ptr-ss-chandu', 'flow-std', 'chn-ss', [sp('ptr-cnf-hyd', 'chn-cnf')], [{ channelId: 'chn-dist', partnerIds: ['ptr-dist-vja'] }], '2026-02-06T10:00:00Z'),
  // Krishna Medi buys Arthroplasty from Chandu SS, Trauma via Deccan C&F (company), with Deccan as backup for Arthroplasty
  map('map-dist-vja', 'ptr-dist-vja', 'flow-std', 'chn-dist', [
    sp('ptr-ss-chandu', 'chn-ss', 'PRIMARY', ['port-arthro']),
    sp('ptr-cnf-hyd', 'chn-cnf', 'PRIMARY', ['port-trauma']),
    sp('ptr-cnf-hyd', 'chn-cnf', 'BACKUP', ['port-arthro']),
  ], [{ channelId: 'chn-dealer', partnerIds: ['ptr-dlr-benz'] }, { channelId: 'chn-hosp', partnerIds: ['ptr-hosp-vja'] }], '2026-02-10T10:00:00Z'),
  map('map-1', 'ptr-dlr-benz', 'flow-std', 'chn-dealer', [sp('ptr-dist-vja', 'chn-dist')], [{ channelId: 'chn-hosp', partnerIds: ['ptr-hosp-vja'] }]),
  map('map-2', 'ptr-dist-hyd', 'flow-std', 'chn-dist', [sp('ptr-cnf-hyd', 'chn-cnf')], [{ channelId: 'chn-hosp', partnerIds: ['ptr-hosp-sec'] }]),
  map('map-3', 'ptr-dist-blr', 'flow-regional', 'chn-dist', [co('wh-peen-04')], [{ channelId: 'chn-hosp', partnerIds: ['ptr-hosp-blr'] }], '2026-04-12T10:00:00Z'),
  map('map-4', 'ptr-hosp-hyd', 'flow-direct', 'chn-hosp', [co()], [], '2026-03-12T10:00:00Z'),
  map('map-cnf-mum', 'ptr-cnf-mum', 'flow-west-ss', 'chn-cnf', [co('wh-bhiw-01')], [], '2026-04-15T10:00:00Z'),
  map('map-5', 'ptr-ss-pune', 'flow-west-ss', 'chn-ss', [sp('ptr-cnf-mum', 'chn-cnf')], [], '2026-05-02T10:00:00Z'),
];

/* Hospital coverage: who serves each hospital, per portfolio (metrics = sample figures until secondary sales are connected). */
const asg = (id: string, customerId: string, portfolioId: string | null, partnerId: string | null, role: 'PRIMARY' | 'BACKUP', from: string, extra: Partial<CustomerAssignment> = {}): CustomerAssignment => ({
  id, customerId, portfolioId, servedBy: partnerId ? 'PARTNER' : 'DIRECT', partnerId, role, effectiveFrom: from, effectiveTo: null, improvement: null,
  ...stamp(`${from}T10:00:00Z`, 'Regional Sales Head'), ...extra,
});
const assignments: CustomerAssignment[] = [
  asg('asg-1', 'ptr-hosp-vja', 'port-arthro', 'ptr-dlr-benz', 'PRIMARY', '2026-03-10', { metrics: { salesL: 6.2, targetPct: 64, fillRatePct: 82, deliveryDays: 4, complaints: 2, paymentDays: 72 } }),
  asg('asg-2', 'ptr-hosp-vja', 'port-arthro', 'ptr-dist-vja', 'BACKUP', '2026-06-01', { metrics: { salesL: 2.1, targetPct: 92, fillRatePct: 97, deliveryDays: 1, complaints: 0, paymentDays: 48 } }),
  asg('asg-3', 'ptr-hosp-vja', 'port-trauma', 'ptr-dist-hyd', 'PRIMARY', '2025-11-01', { effectiveTo: '2026-02-14', endReason: 'Coverage change', endNotes: 'Vijayawada handed to the local distributor', endedBy: 'Regional Sales Head', replacedById: 'asg-4', metrics: { salesL: 3.4, targetPct: 71, fillRatePct: 90, deliveryDays: 3, complaints: 1, paymentDays: 60 } }),
  asg('asg-4', 'ptr-hosp-vja', 'port-trauma', 'ptr-dist-vja', 'PRIMARY', '2026-02-15', { metrics: { salesL: 9.8, targetPct: 104, fillRatePct: 98, deliveryDays: 1, complaints: 0, paymentDays: 45 } }),
  asg('asg-5', 'ptr-hosp-hyd', null, null, 'PRIMARY', '2026-03-12'),
  asg('asg-6', 'ptr-hosp-sec', 'port-arthro', 'ptr-dist-hyd', 'PRIMARY', '2026-05-01', { metrics: { salesL: 11.5, targetPct: 97, fillRatePct: 96, deliveryDays: 2, complaints: 0, paymentDays: 50 } }),
  asg('asg-7', 'ptr-hosp-sec', 'port-trauma', null, 'PRIMARY', '2026-05-01'),
  asg('asg-8', 'ptr-hosp-blr', null, 'ptr-dist-blr', 'PRIMARY', '2026-04-12', { metrics: { salesL: 7.9, targetPct: 78, fillRatePct: 88, deliveryDays: 3, complaints: 1, paymentDays: 66 } }),
];


/* --------------------------- Commercial terms --------------------------- */
const term = (r: Omit<CommercialTermRecord, keyof ReturnType<typeof stamp>>, date = '2026-03-01T10:00:00Z'): CommercialTermRecord => ({ ...r, ...stamp(date, r.requestedBy) });

const termRecords: CommercialTermRecord[] = [
  term({ id: 'term-1', scope: 'TERRITORY', channelId: 'chn-dist', territoryId: 'ter-ap', partnerId: null, mappingId: null, values: { standardDiscountPct: 9, creditPeriodDays: 60 }, overrideReason: 'AP market credit norms', requestedBy: 'Regional Sales Head', approvalStatus: 'Approved', effectiveFrom: '2026-02-01', effectiveTo: null }),
  term({ id: 'term-2', scope: 'TERRITORY', channelId: 'chn-hosp', territoryId: 'ter-ka', partnerId: null, mappingId: null, values: { creditPeriodDays: 90 }, overrideReason: 'Karnataka institutional payment cycles', requestedBy: 'Regional Sales Head', approvalStatus: 'Approved', effectiveFrom: '2026-02-01', effectiveTo: null }),
  term({ id: 'term-3', scope: 'PARTNER', channelId: 'chn-dist', territoryId: null, partnerId: 'ptr-dist-vja', mappingId: null, values: { standardDiscountPct: 11, creditLimit: 7500000 }, overrideReason: 'Top performing distributor FY26', requestedBy: 'Area Sales Manager', approvalStatus: 'Approved', effectiveFrom: '2026-03-01', effectiveTo: null }),
  term({ id: 'term-4', scope: 'RELATIONSHIP', channelId: 'chn-dealer', territoryId: null, partnerId: 'ptr-dlr-benz', mappingId: 'map-1', values: { creditPeriodDays: 45 }, overrideReason: 'Hospital receivable cycle alignment', requestedBy: 'Area Sales Manager', approvalStatus: 'Approved', effectiveFrom: '2026-03-10', effectiveTo: null }),
  term({ id: 'term-5', scope: 'PARTNER', channelId: 'chn-dist', territoryId: null, partnerId: 'ptr-dist-blr', mappingId: null, values: { standardDiscountPct: 12 }, overrideReason: 'Robotics launch support', requestedBy: 'Area Sales Manager', approvalStatus: 'Pending', effectiveFrom: '2026-11-01', effectiveTo: null }, '2026-10-30T10:00:00Z'),
  term({ id: 'term-6', scope: 'PARTNER', channelId: 'chn-cnf', territoryId: null, partnerId: 'ptr-cnf-mum', mappingId: null, values: { depositRequired: false, depositAmount: 0 }, overrideReason: 'Long-standing C&F with bank guarantee', requestedBy: 'Regional Sales Head', approvalStatus: 'Pending', effectiveFrom: '2026-11-01', effectiveTo: null }, '2026-10-31T10:00:00Z'),
];

/* ------------------------------- Approvals ------------------------------ */
const steps = (levels: string[]) => levels.map((role, i) => ({ level: i + 1, role, status: i === 0 ? 'Pending' as const : 'Waiting' as const, actedBy: null, actedAt: null, comments: '' }));

const approvals: ApprovalRequest[] = [
  { id: 'apr-1', requestNo: 'REQ-0001', category: 'PARTNER_ONBOARDING', partnerId: 'ptr-dlr-gnt', entityType: 'PARTNER', entityId: 'ptr-dlr-gnt', summary: 'Onboard Guntur Surgical House as Dealer', details: [{ label: 'Partner Type', to: 'Dealer' }, { label: 'Territories', to: 'Guntur' }], requestedBy: 'Area Sales Manager', requestedAt: '2026-10-21T10:00:00Z', status: 'Pending', currentLevel: 1, steps: steps(['Regional Sales Head', 'Commercial Head']) },
  { id: 'apr-2', requestNo: 'REQ-0002', category: 'KYC_VERIFICATION', partnerId: 'ptr-dist-chn', entityType: 'PARTNER', entityId: 'ptr-dist-chn', summary: 'Verify KYC documents for Marina Health Distributors', details: [{ label: 'Documents', to: '3 uploaded' }], requestedBy: 'Area Sales Manager', requestedAt: '2026-10-26T10:00:00Z', status: 'Pending', currentLevel: 1, steps: steps(['Compliance Officer']) },
  { id: 'apr-3', requestNo: 'REQ-0003', category: 'DISCOUNT_OVERRIDE', partnerId: 'ptr-dist-blr', entityType: 'TERM', entityId: 'term-5', summary: 'Discount override for Garden City Meditech', details: [{ label: 'Discount %', from: '8', to: '12' }], requestedBy: 'Area Sales Manager', requestedAt: '2026-10-30T10:00:00Z', status: 'Pending', currentLevel: 1, steps: steps(['Regional Sales Head', 'Finance Controller']) },
  { id: 'apr-4', requestNo: 'REQ-0004', category: 'DEPOSIT_WAIVER', partnerId: 'ptr-cnf-mum', entityType: 'TERM', entityId: 'term-6', summary: 'Deposit waiver for Bhiwandi C&F Services', details: [{ label: 'Deposit Required', from: 'Yes', to: 'No' }, { label: 'Deposit Amount', from: '25,00,000', to: '0' }], requestedBy: 'Regional Sales Head', requestedAt: '2026-10-31T10:00:00Z', status: 'Pending', currentLevel: 1, steps: steps(['Finance Controller']) },
  { id: 'apr-5', requestNo: 'REQ-0005', category: 'DISCOUNT_OVERRIDE', partnerId: 'ptr-dist-vja', entityType: 'TERM', entityId: 'term-3', summary: 'Discount override for Krishna Medi Distributors', details: [{ label: 'Discount %', from: '9', to: '11' }], requestedBy: 'Area Sales Manager', requestedAt: '2026-02-28T10:00:00Z', status: 'Approved', currentLevel: 2,
    steps: [{ level: 1, role: 'Regional Sales Head', status: 'Approved', actedBy: 'K. Raghav', actedAt: '2026-03-01T08:00:00Z', comments: 'OK' }, { level: 2, role: 'Finance Controller', status: 'Approved', actedBy: 'M. Iyer', actedAt: '2026-03-01T09:00:00Z', comments: 'Approved' }] },
  { id: 'apr-6', requestNo: 'REQ-0006', category: 'PARTNER_ONBOARDING', partnerId: 'ptr-dist-wgl', entityType: 'PARTNER', entityId: 'ptr-dist-wgl', summary: 'Onboard Kakatiya Pharma Links as Distributor', details: [{ label: 'Territories', to: 'Warangal' }], requestedBy: 'Area Sales Manager', requestedAt: '2026-09-14T10:00:00Z', status: 'Rejected', currentLevel: 1,
    steps: [{ level: 1, role: 'Regional Sales Head', status: 'Rejected', actedBy: 'K. Raghav', actedAt: '2026-09-15T10:00:00Z', comments: 'MD-42 sale registration expired' }, { level: 2, role: 'Commercial Head', status: 'Waiting', actedBy: null, actedAt: null, comments: '' }] },
];

/* ---------------------------- Configuration ----------------------------- */
const config: GtmConfiguration = {
  partnerTypes: [
    { id: 'pt-cnf', code: 'CNF', name: 'C&F Agent', description: 'Carrying & forwarding agent', channelId: 'chn-cnf', status: 'Active', onboardingForm: 'full' },
    { id: 'pt-ss', code: 'SS', name: 'Super Stockist', description: 'Regional stockist', channelId: 'chn-ss', status: 'Active', onboardingForm: 'full' },
    { id: 'pt-dist', code: 'DIST', name: 'Distributor', description: 'Authorised distributor', channelId: 'chn-dist', status: 'Active', onboardingForm: 'full' },
    { id: 'pt-dealer', code: 'DLR', name: 'Dealer', description: 'Sub-distribution dealer', channelId: 'chn-dealer', status: 'Active', onboardingForm: 'full' },
    { id: 'pt-retail', code: 'RTL', name: 'Retailer', description: 'Retail outlet', channelId: 'chn-retail', status: 'Active', onboardingForm: 'full' },
    { id: 'pt-hosp', code: 'HOSP', name: 'Hospital / Institution', description: 'End customer institution', channelId: 'chn-hosp', status: 'Active', onboardingForm: 'short' },
  ],
  kycDocuments: [
    { id: 'kyc-gst', name: 'GST Certificate', description: 'GST registration certificate', mandatoryForPartnerTypeIds: ['pt-cnf', 'pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail', 'pt-hosp'], allowedFormats: ['pdf', 'jpg', 'png'], maxSizeMb: 5, status: 'Active' },
    { id: 'kyc-pan', name: 'PAN Card', description: 'Business PAN', mandatoryForPartnerTypeIds: ['pt-cnf', 'pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail', 'pt-hosp'], allowedFormats: ['pdf', 'jpg', 'png'], maxSizeMb: 5, status: 'Active' },
    { id: 'kyc-dl', name: MD42_NAME, description: MD42_DESC, mandatoryForPartnerTypeIds: ['pt-cnf', 'pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail'], allowedFormats: ['pdf'], maxSizeMb: 10, status: 'Active', tracksExpiry: true },
    { id: 'kyc-cea', name: 'Clinical Establishment Registration', description: 'Hospital registration under the Clinical Establishments Act / state Nursing Home Act', mandatoryForPartnerTypeIds: [], allowedFormats: ['pdf', 'jpg', 'png'], maxSizeMb: 10, status: 'Active', tracksExpiry: true },
    { id: 'kyc-bank', name: 'Cancelled Cheque', description: 'Bank account proof', mandatoryForPartnerTypeIds: [], allowedFormats: ['pdf', 'jpg', 'png'], maxSizeMb: 5, status: 'Active' },
    { id: 'kyc-agreement', name: 'Signed Distribution Agreement', description: 'Executed agreement', mandatoryForPartnerTypeIds: ['pt-cnf'], allowedFormats: ['pdf'], maxSizeMb: 15, status: 'Active' },
  ],
  eligibility: { requireChannelMatch: true, requireTerritoryOverlap: true, territoryMatchMode: 'hierarchy', requireActiveStatus: true, requireKycVerified: true },
  flowRules: { requireSourceFirst: true, minStages: 2, maxStages: null, preventDuplicateChannel: true, enforceTierOrder: true, requireEndpointLast: false, blockedConnections: [{ fromChannelId: 'chn-retail', toChannelId: 'chn-hosp' }] },
  territoryRules: {
    levelLabels: [
      { depth: 0, label: 'Country' }, { depth: 1, label: 'State' }, { depth: 2, label: 'Region' }, { depth: 3, label: 'City' }, { depth: 4, label: 'Local Area' },
    ],
    maxDepth: null, uniqueNameWithinParent: true, codeUppercase: true,
  },
  approvalWorkflows: [
    { category: 'PARTNER_ONBOARDING', label: 'Partner Onboarding', enabled: true, levels: ['Regional Sales Head', 'Commercial Head'] },
    { category: 'KYC_VERIFICATION', label: 'KYC Verification', enabled: true, levels: ['Compliance Officer'] },
    { category: 'DISCOUNT_OVERRIDE', label: 'Discount Override', enabled: true, levels: ['Regional Sales Head', 'Finance Controller'] },
    { category: 'CREDIT_LIMIT_CHANGE', label: 'Credit Limit Change', enabled: true, levels: ['Finance Controller'] },
    { category: 'CREDIT_PERIOD_EXTENSION', label: 'Credit Period Extension', enabled: true, levels: ['Finance Controller'] },
    { category: 'DEPOSIT_WAIVER', label: 'Deposit Waiver', enabled: true, levels: ['Finance Controller'] },
    { category: 'INSTITUTION_ONBOARDING', label: 'Institution Onboarding', enabled: true, levels: ['Key Account Manager'] },
    { category: 'CREDIT_HOLD_RELEASE', label: 'Credit Hold Release', enabled: true, levels: ['Finance Controller'] },
    { category: 'CUSTOMER_TRANSFER', label: 'Hospital Transfer / Removal', enabled: true, levels: ['Regional Sales Head'] },
  ],
  coverage: {
    onePrimaryPerPortfolio: true, allowBackup: true, watchBelow: 75, improveBelow: 60, improvementDays: 60, requireHandover: true,
    transferReasons: ['Poor performance', 'Coverage change', 'Partner request', 'Hospital request', 'Compliance issue', 'Partner exit'],
  },
  compliance: { expiryAlertDays: 30, blockOnExpiredLicence: true, creditWarnPct: 80, blockWhenOverLimit: true, blockWhenOverdue: false },
  portal: { partnerTypeIds: ['pt-cnf', 'pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail', 'pt-hosp'], autoInviteOnActivation: true, inviteValidityDays: 7 },
  institutionOnboarding: {
    fields: {
      gst: 'optional', pan: 'optional', contactPerson: 'required', email: 'optional', phone: 'required', address: 'required',
      institutionType: 'required', ownership: 'required', bedCount: 'optional', registrationNo: 'optional',
      drugLicenseNo: 'optional', procurementContact: 'optional', hospitalGroup: 'optional',
    },
    verifyGstWhenProvided: true,
    requireApproval: false,
    institutionTypes: ['Multi-speciality Hospital', 'Single-speciality Hospital', 'Nursing Home', 'Clinic', 'Diagnostic Centre', 'Medical College', 'Government Institution'],
    ownershipTypes: ['Private', 'Government', 'Trust / Charitable', 'Corporate Chain'],
  },
  partnerStatuses: [
    { key: 'Draft', label: 'Draft', tone: 'slate', description: 'Onboarding not yet submitted' },
    { key: 'KYC Pending', label: 'KYC Pending', tone: 'amber', description: 'Mandatory KYC documents missing' },
    { key: 'KYC Under Review', label: 'KYC Under Review', tone: 'blue', description: 'Compliance verifying documents' },
    { key: 'Approval Pending', label: 'Approval Pending', tone: 'purple', description: 'Awaiting onboarding approval' },
    { key: 'Active', label: 'Active', tone: 'green', description: 'Trading partner' },
    { key: 'Suspended', label: 'Suspended', tone: 'red', description: 'Temporarily blocked from trading' },
    { key: 'Rejected', label: 'Rejected', tone: 'red', description: 'Onboarding rejected' },
  ],
};


/** Partner licences other industries need instead of the medical ones. */
export const INDUSTRY_KYC: Record<string, { id: string; name: string; description: string; types: string[] }[]> = {
  agri: [
    { id: 'kyc-ins', name: 'Insecticide Selling Licence', description: 'Licence to sell insecticides (Insecticides Rules 1971), state agriculture department', types: ['pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail'] },
    { id: 'kyc-seed', name: 'Seed Dealer Licence', description: 'Licence to sell seeds (Seeds Control Order 1983)', types: ['pt-ss', 'pt-dist', 'pt-dealer', 'pt-retail'] },
    { id: 'kyc-fert', name: 'Fertiliser Dealer Registration', description: 'Authorisation to sell fertiliser (Fertiliser Control Order 1985)', types: ['pt-dist', 'pt-dealer', 'pt-retail'] },
  ],
  automotive: [
    { id: 'kyc-trade', name: 'Trade / Shops & Establishment Licence', description: 'Municipal trade licence of the outlet', types: [] },
  ],
  electronics: [
    { id: 'kyc-trade', name: 'Trade / Shops & Establishment Licence', description: 'Municipal trade licence of the outlet', types: [] },
    { id: 'kyc-epr-pro', name: 'E-waste Collection Tie-up', description: 'Take-back / collection arrangement with an authorised recycler (E-Waste Rules 2022)', types: ['pt-dist'] },
  ],
};

export const buildSeedDatabase = (): GtmDatabase => ({
  schemaVersion: SCHEMA_VERSION,
  territories: structuredClone(territories),
  zones: structuredClone(zones),
  channels: structuredClone(channels),
  flows: structuredClone(flows),
  partners: structuredClone(partners),
  mappings: structuredClone(mappings),
  flowOverrides: [],
  terms: structuredClone(termRecords),
  approvals: structuredClone(approvals),
  assignments: structuredClone(assignments),
  transfers: [],
  config: structuredClone(config),
  counters: { approval: 6, partner: partners.length, flow: flows.length },
});
