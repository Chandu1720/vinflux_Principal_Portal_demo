import type { ReportDefinition } from './types';
import { territoryReport } from './territoryReport';
import { zoneReport, channelReport } from './zoneChannelReports';
import { flowReport } from './flowReport';
import { activeInactiveReport, kycPendingReport } from './partnerReports';
import { commercialReport } from './commercialReport';
import { orderingReport } from './orderingReport';
import { healthReport } from './healthReport';
import { coverageReport } from './coverageReport';

/** Registry — add a new report by creating a definition file and listing it here. */
export const REPORTS = [
  territoryReport, zoneReport, channelReport, flowReport, activeInactiveReport, kycPendingReport, commercialReport, orderingReport, healthReport, coverageReport,
] as unknown as ReportDefinition<unknown>[];

export * from './types';
