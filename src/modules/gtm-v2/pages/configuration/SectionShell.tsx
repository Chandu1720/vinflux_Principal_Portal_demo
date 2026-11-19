import React from 'react';
import { Lock, Save, Undo2 } from 'lucide-react';
import { Badge, Button, Card, ErrorList } from '../../components/ui';

export const SectionShell: React.FC<{
  title: string;
  description: string;
  dirty: boolean;
  pending: boolean;
  errors: string[];
  readOnly: boolean;
  onSave: () => void;
  onDiscard: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, dirty, pending, errors, readOnly, onSave, onDiscard, extraActions, children }) => (
  <Card
    title={<span className="g2-row" style={{ gap: 8 }}>{title}{dirty && <Badge tone="amber" dot>Unsaved changes</Badge>}{readOnly && <Badge tone="slate"><Lock size={11} /> Read-only</Badge>}</span>}
    subtitle={description}
    actions={<>
      {extraActions}
      {!readOnly && <>
        <Button icon={<Undo2 size={15} />} disabled={!dirty || pending} onClick={onDiscard}>Discard</Button>
        <Button variant="primary" icon={<Save size={15} />} disabled={!dirty} loading={pending} onClick={onSave}>Save</Button>
      </>}
    </>}
  >
    <div className="g2-stack">
      {readOnly && <div className="g2-alert g2-alert-warn">You need configuration permission (Admin: Config Enabled in VinFlux) to change these settings.</div>}
      <ErrorList errors={errors} />
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
    </div>
  </Card>
);
