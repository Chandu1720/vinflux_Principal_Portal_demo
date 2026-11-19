import React, { useState } from 'react';
import { BadgeCheck, Building2, Hospital, FileCheck2, GitFork, Globe, Info, ListChecks, Map, ShieldCheck, Tag, Users } from 'lucide-react';
import { useChannels, useConfig, usePartners, useTerritories } from '../../hooks/useGtmData';
import { Alert, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { PartnerTypesSection } from './sections/PartnerTypesSection';
import { KycDocumentsSection } from './sections/KycDocumentsSection';
import { EligibilitySection } from './sections/EligibilitySection';
import { FlowRulesSection } from './sections/FlowRulesSection';
import { ApprovalWorkflowsSection } from './sections/ApprovalWorkflowsSection';
import { TerritoryRulesSection } from './sections/TerritoryRulesSection';
import { StatusSection } from './sections/StatusSection';
import { InstitutionSection } from './sections/InstitutionSection';
import { ComplianceCreditSection } from './sections/ComplianceCreditSection';
import { PortalSection } from './sections/PortalSection';
import { CoverageSection } from './sections/CoverageSection';

const SECTIONS = [
  { id: 'partnerTypes', label: 'Partner Types', icon: Users },
  { id: 'kyc', label: 'KYC Documents', icon: FileCheck2 },
  { id: 'compliance', label: 'Compliance & Credit', icon: ShieldCheck },
  { id: 'portal', label: 'Partner Portal', icon: Globe },
  { id: 'institution', label: 'Short Onboarding Form', icon: Building2 },
  { id: 'coverage', label: 'Hospital Coverage', icon: Hospital },
  { id: 'eligibility', label: 'Eligibility Rules', icon: BadgeCheck },
  { id: 'flowRules', label: 'Route Rules', icon: GitFork },
  { id: 'approvals', label: 'Approval Workflows', icon: ListChecks },
  { id: 'territory', label: 'Territory Rules', icon: Map },
  { id: 'status', label: 'Status Configuration', icon: Tag },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const ConfigurationPage: React.FC = () => {
  const configQ = useConfig();
  const channels = useChannels().data ?? [];
  const partners = usePartners().data ?? [];
  const territories = useTerritories().data ?? [];
  const [active, setActive] = useState<SectionId>('partnerTypes');

  if (configQ.error) return <ErrorState message={configQ.error} onRetry={configQ.refetch} />;
  if (!configQ.data) return <LoadingState label="Loading configuration…" />;
  const config = configQ.data;

  const body = (() => {
    switch (active) {
      case 'partnerTypes': return <PartnerTypesSection config={config} channels={channels} partners={partners} />;
      case 'kyc': return <KycDocumentsSection config={config} />;
      case 'compliance': return <ComplianceCreditSection config={config} />;
      case 'portal': return <PortalSection config={config} />;
      case 'coverage': return <CoverageSection config={config} />;
      case 'institution': return <InstitutionSection config={config} />;
      case 'eligibility': return <EligibilitySection config={config} />;
      case 'flowRules': return <FlowRulesSection config={config} channels={channels} />;
      case 'approvals': return <ApprovalWorkflowsSection config={config} />;
      case 'territory': return <TerritoryRulesSection config={config} territories={territories} />;
      case 'status': return <StatusSection config={config} />;
    }
  })();

  return (
    <>
      <PageHeader title="Configuration" description="Master settings that drive Go-to-Market behaviour. Nothing here is hard-coded in pages." />
      <div style={{ marginBottom: 16 }}>
        <Alert tone="info" icon={<Info size={16} />}>
          Configuration changes apply to <strong>new transactions only</strong>. Existing active partner relationships, approved terms and in-flight approvals keep the values they were created with.
        </Alert>
      </div>
      <div className="g2-config-layout">
        <nav className="g2-card g2-config-nav" aria-label="Configuration sections">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" className={active === s.id ? 'active' : ''} onClick={() => setActive(s.id)}>
                <s.icon size={16} />{s.label}
              </button>
            ))}
        </nav>
        {/* key resets local draft state when switching sections */}
        <div key={active} style={{ minWidth: 0 }}>{body}</div>
      </div>
    </>
  );
};

export default ConfigurationPage;
