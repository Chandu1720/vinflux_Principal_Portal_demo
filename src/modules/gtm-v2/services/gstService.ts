/**
 * GSTIN verification.
 *
 * INTEGRATION POINT: in production this must be a BACKEND call
 *   GET {API_BASE}/gst/taxpayers/:gstin
 * which proxies the GSTN "Search Taxpayer" API through your GST Suvidha Provider (GSP).
 * GSTN credentials must never be exposed to the browser.
 *
 * Until then a SANDBOX registry is used. Any GSTIN is first validated offline
 * (format, state code, mod-36 check digit); only sandbox GSTINs return registry details.
 */
import type { GstVerification } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { checkGstin } from '../utils/gstin';

type RegistryEntry = Omit<GstVerification, 'gstin' | 'stateCode' | 'state' | 'pan' | 'verifiedAt' | 'verifiedBy' | 'source'>;

/** Fictitious sandbox taxpayers (all GSTINs carry valid check digits). */
const SANDBOX_REGISTRY: Record<string, RegistryEntry> = {
  '37AAJFV4821K1ZR': {
    legalName: 'VIJAYA ORTHO DEALERS LLP', tradeName: 'Vijaya Ortho Dealers', status: 'Active', taxpayerType: 'Regular',
    constitution: 'Limited Liability Partnership', registrationDate: '2019-07-12',
    address: { line1: 'D.No. 40-1-52, MG Road, Labbipet', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520010' },
  },
  '36AAECC5521M1ZK': {
    legalName: 'CYBERABAD MEDISUPPLY PRIVATE LIMITED', tradeName: 'Cyberabad Medisupply', status: 'Active', taxpayerType: 'Regular',
    constitution: 'Private Limited Company', registrationDate: '2018-03-02',
    address: { line1: 'Plot 22, Phase II, HITEC City', city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
  },
  '29AAGCG7310P1Z4': {
    legalName: 'GANGA SURGICALS PRIVATE LIMITED', tradeName: 'Ganga Surgicals', status: 'Active', taxpayerType: 'Regular',
    constitution: 'Private Limited Company', registrationDate: '2017-11-20',
    address: { line1: '14/2, 3rd Cross, Peenya Industrial Area', city: 'Bengaluru', state: 'Karnataka', pincode: '560058' },
  },
  '27AAFCB9076Q1ZT': {
    legalName: 'BHAVANI HEALTHCARE DISTRIBUTORS PRIVATE LIMITED', tradeName: 'Bhavani Healthcare', status: 'Active', taxpayerType: 'Regular',
    constitution: 'Private Limited Company', registrationDate: '2020-01-08',
    address: { line1: 'Unit 7, Andheri Kurla Road, Marol', city: 'Mumbai', state: 'Maharashtra', pincode: '400059' },
  },
  '33AAKFM3348D1ZI': {
    legalName: 'MARINA MEDICAL AGENCIES', tradeName: 'Marina Medical Agencies', status: 'Active', taxpayerType: 'Composition',
    constitution: 'Partnership', registrationDate: '2021-06-15',
    address: { line1: '118, Anna Salai, Teynampet', city: 'Chennai', state: 'Tamil Nadu', pincode: '600018' },
  },
  '36AACCK6402H1ZR': {
    legalName: 'KONDAPUR PHARMA TRADERS PRIVATE LIMITED', tradeName: 'Kondapur Pharma Traders', status: 'Cancelled', taxpayerType: 'Regular',
    constitution: 'Private Limited Company', registrationDate: '2016-09-30',
    address: { line1: '2-48, Kondapur Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500084' },
  },
};

export const SANDBOX_GSTINS = Object.entries(SANDBOX_REGISTRY).map(([gstin, e]) => ({ gstin, name: e.tradeName, status: e.status }));

export const gstService = {
  verify: (rawGstin: string, actor: string) => mockCall((): GstVerification => {
    const gstin = rawGstin.trim().toUpperCase();
    const check = checkGstin(gstin);
    if (!check.ok) throw new ServiceError(check.error);
    const entry = SANDBOX_REGISTRY[gstin];
    if (!entry) {
      throw new ServiceError(`GSTIN ${gstin} is structurally valid (${check.state}) but was not found in the GST registry sandbox. Connect the GSP backend to verify live GSTINs.`);
    }
    return {
      gstin, ...entry, stateCode: check.stateCode, state: check.state, pan: check.pan,
      verifiedAt: new Date().toISOString(), verifiedBy: actor, source: 'GST registry sandbox (mock)',
    };
  }, 650),
};
