import React from 'react';
import { Building2, ChevronRight, Users } from 'lucide-react';
import { Modal } from '../../components/ui';
import type { GtmConfiguration, SalesChannel } from '../../types';

/**
 * One entry point for onboarding: pick the partner type first. Full types open the 7-step wizard,
 * short types (hospitals / institutions) open the one-screen form.
 */
export const PartnerTypeChooser: React.FC<{
  config: GtmConfiguration;
  channels: SalesChannel[];
  onPick: (typeId: string, form: 'full' | 'short') => void;
  onClose: () => void;
}> = ({ config, channels, onPick, onClose }) => {
  const active = config.partnerTypes.filter((t) => t.status === 'Active');
  const groups: { form: 'full' | 'short'; title: string; hint: string; icon: React.ReactNode }[] = [
    { form: 'full', title: 'Trading partners', hint: 'Full onboarding: GSTIN, territories, products, supply links, KYC, terms, approval', icon: <Users size={16} /> },
    { form: 'short', title: 'End customers', hint: 'Short form: one screen, optional approval', icon: <Building2 size={16} /> },
  ];
  return (
    <Modal open title="Onboard partner" subtitle="Choose the partner type — it decides the onboarding form." onClose={onClose}>
      <div className="g2-stack">
        {groups.map((g) => {
          const types = active.filter((t) => (t.onboardingForm ?? 'full') === g.form);
          if (!types.length) return null;
          return (
            <div key={g.form}>
              <div className="g2-row" style={{ marginBottom: 6 }}>{g.icon}<strong>{g.title}</strong></div>
              <div className="g2-small g2-muted" style={{ marginBottom: 8 }}>{g.hint}</div>
              <div className="g2-stack" style={{ gap: 6 }}>
                {types.map((t) => (
                  <button key={t.id} type="button" className="g2-type-pick" onClick={() => onPick(t.id, g.form)}>
                    <div style={{ textAlign: 'left' }}>
                      <div className="g2-strong">{t.name}</div>
                      <div className="g2-cell-sub">{channels.find((c) => c.id === t.channelId)?.name ?? 'No channel'}{t.description ? ` · ${t.description}` : ''}</div>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="g2-small g2-muted">Which form a type uses is set in Configuration → Partner Types.</div>
      </div>
    </Modal>
  );
};
