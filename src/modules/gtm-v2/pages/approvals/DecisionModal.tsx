import React, { useState } from 'react';
import type { ApprovalRequest } from '../../types';
import { Button, Field, Modal, Textarea } from '../../components/ui';

export const DecisionModal: React.FC<{
  req: ApprovalRequest;
  mode: 'Approved' | 'Rejected';
  categoryLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (comments: string) => void;
}> = ({ req, mode, categoryLabel, pending, onCancel, onSubmit }) => {
  const [comments, setComments] = useState('');
  const [touched, setTouched] = useState(false);
  const reject = mode === 'Rejected';
  const step = req.steps.find((s) => s.level === req.currentLevel);
  const isLast = req.currentLevel >= req.steps.length;
  const invalid = reject && !comments.trim();
  return (
    <Modal
      open
      title={`${reject ? 'Reject' : 'Approve'} ${req.requestNo}`}
      subtitle={`${categoryLabel} · Level ${req.currentLevel} (${step?.role ?? '—'})`}
      onClose={onCancel}
      footer={<>
        <Button onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button variant={reject ? 'danger' : 'success'} loading={pending} onClick={() => { setTouched(true); if (!invalid) onSubmit(comments.trim()); }}>
          {reject ? 'Reject request' : isLast ? 'Approve (final)' : 'Approve & forward'}
        </Button>
      </>}
    >
      <div className="g2-stack">
        <div className={`g2-alert ${reject ? 'g2-alert-error' : 'g2-alert-info'}`}>
          {reject
            ? 'Rejecting closes the request at this level. Linked changes will not take effect.'
            : isLast
              ? 'This is the final approval level — the change takes effect immediately.'
              : `After approval the request moves to level ${req.currentLevel + 1}: ${req.steps.find((s) => s.level === req.currentLevel + 1)?.role}.`}
        </div>
        <div className="g2-small">{req.summary}</div>
        <Field label={reject ? 'Rejection reason' : 'Comments'} required={reject} error={touched && invalid ? 'A rejection reason is required.' : null}>
          <Textarea value={comments} invalid={touched && invalid} onChange={(e) => setComments(e.target.value)} placeholder={reject ? 'Explain why this request is rejected…' : 'Optional comments'} autoFocus />
        </Field>
      </div>
    </Modal>
  );
};
