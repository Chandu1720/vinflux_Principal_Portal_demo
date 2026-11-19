import type { GtmConfiguration } from '../../types';
import type { useGtmBundle } from '../../hooks/useGtmData';
import type { WizardState } from './wizardModel';

export type GtmBundle = ReturnType<typeof useGtmBundle>;

export interface StepProps {
  state: WizardState;
  update: (fn: (s: WizardState) => WizardState) => void;
  data: GtmBundle;
  config: GtmConfiguration;
  /** Whether the user has tried to advance (show validation). */
  showErrors: boolean;
}
