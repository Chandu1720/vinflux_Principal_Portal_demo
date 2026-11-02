import React, { useState } from 'react';
import { PartnerList } from '../components/partner/PartnerList';
import { PartnerFormModal } from '../components/partner/PartnerFormModal';
import { PartnerOnboardingWizard } from '../components/partner/PartnerOnboardingWizard';
import { PartnerDetailsModal } from '../components/partner/PartnerDetailsModal';
import { TerritoryAssignmentModal } from '../components/partner/TerritoryAssignmentModal';
import { InvitePartnerModal } from '../components/partner/InvitePartnerModal';
import type { Partner } from '../types/partner';
import { Users, Plus } from 'lucide-react';

export const PartnerManagementPage: React.FC = () => {
  // Modal states
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedEditPartner, setSelectedEditPartner] = useState<Partner | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDetailsPartner, setSelectedDetailsPartner] = useState<Partner | null>(null);

  const [isTerritoryModalOpen, setIsTerritoryModalOpen] = useState(false);
  const [selectedTerritoryPartner, setSelectedTerritoryPartner] = useState<Partner | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedInvitePartner, setSelectedInvitePartner] = useState<Partner | null>(null);

  // Open 5-Step Guided Onboarding Wizard
  const handleOpenOnboardWizard = () => {
    setIsOnboardingOpen(true);
  };

  // Open Quick Edit
  const handleEditPartner = (partner: Partner) => {
    setSelectedEditPartner(partner);
    setIsFormModalOpen(true);
  };

  // Open Full Partner Details View (Section 8)
  const handleViewDetails = (partner: Partner) => {
    setSelectedDetailsPartner(partner);
    setIsDetailsModalOpen(true);
  };

  // Open Territory Assignment Modal
  const handleAssignTerritories = (partner: Partner) => {
    setSelectedTerritoryPartner(partner);
    setIsTerritoryModalOpen(true);
  };

  // Open Portal Invitation Modal
  const handleOpenInvite = (partner: Partner) => {
    setSelectedInvitePartner(partner);
    setIsInviteModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', background: '#ffffff', padding: '20px 24px', border: '1px solid var(--vf-slate-200)', borderRadius: 'var(--vf-radius-md)', boxShadow: 'var(--vf-shadow-sm)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} className="text-blue-600" />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--vf-slate-900)' }}>
              Partner Management & Channel Governance
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--vf-slate-500)' }}>
            Manage commercial distributors, statutory KYC documents, multi-territory commercial terms inheritance, branch/warehouse supply linkages, and Distribution Portal invitations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={handleOpenOnboardWizard}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>+ Onboard New Partner</span>
          </button>
        </div>
      </div>

      {/* Main Listing Component */}
      <PartnerList
        onOpenCreate={handleOpenOnboardWizard}
        onEditPartner={handleEditPartner}
        onAssignTerritories={handleAssignTerritories}
        onOpenInviteModal={handleOpenInvite}
        onViewDetails={handleViewDetails}
      />

      {/* 5-Step Guided Onboarding Wizard (Section 6) */}
      <PartnerOnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Partner Details View (Section 8) */}
      <PartnerDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedDetailsPartner(null);
        }}
        partner={selectedDetailsPartner}
        onOpenInviteModal={handleOpenInvite}
      />

      {/* Quick Edit Partner Form Modal */}
      <PartnerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedEditPartner(null);
        }}
        partner={selectedEditPartner}
      />

      {/* Territory & Commercial Assignment Modal */}
      <TerritoryAssignmentModal
        isOpen={isTerritoryModalOpen}
        onClose={() => {
          setIsTerritoryModalOpen(false);
          setSelectedTerritoryPartner(null);
        }}
        partner={selectedTerritoryPartner}
      />

      {/* Portal Invitation Modal */}
      {selectedInvitePartner && (
        <InvitePartnerModal
          isOpen={isInviteModalOpen}
          onClose={() => {
            setIsInviteModalOpen(false);
            setSelectedInvitePartner(null);
          }}
          partner={selectedInvitePartner}
        />
      )}

    </div>
  );
};
