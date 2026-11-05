import type { CustomerAssignment, GtmConfiguration, Partner, Territory } from '../../types';
import { shortFormTypeIds } from '../../utils/eligibility';
import { territoriesOverlap } from '../../utils/territory';

export interface PortfolioCol { id: string; name: string }

/** Active end customers (hospitals) sorted by group then name. */
export const hospitalsOf = (partners: Partner[], config: GtmConfiguration) =>
  partners.filter((p) => shortFormTypeIds(config).includes(p.partnerTypeId) && p.status === 'Active')
    .sort((a, b) => (a.institution?.hospitalGroup ?? '~').localeCompare(b.institution?.hospitalGroup ?? '~') || a.name.localeCompare(b.name));

/** Trading partners that may serve a hospital: active, full-form, territory overlapping the hospital's. */
export const candidatePartners = (hospital: Partner | undefined, partners: Partner[], config: GtmConfiguration, territories: Territory[]) =>
  partners.filter((p) => p.status === 'Active' && !shortFormTypeIds(config).includes(p.partnerTypeId)
    && (!hospital || territoriesOverlap(hospital.territoryIds, p.territoryIds, territories, 'hierarchy')));

export const scopeLabel = (a: Pick<CustomerAssignment, 'portfolioId'>, cols: PortfolioCol[], allNames: (id: string) => string) =>
  a.portfolioId ? cols.find((c) => c.id === a.portfolioId)?.name ?? allNames(a.portfolioId) : 'All portfolios';
