import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Send } from 'lucide-react';
import { Alert, Button, Card, ConfirmDialog, ErrorList, ErrorState, LoadingState, Modal, Stepper } from '../../components/ui';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { partnerService } from '../../services';
import PartnersPage from './PartnersPage';
import { ROUTES } from '../../constants/navigation';
import { STEP, STEPS, emptyExtras, emptyInput, stateFromPartner, validateStep } from './wizardModel';
import type { WizardState } from './wizardModel';
import { StepBasic } from './StepBasic';
import { StepKyc } from './StepKyc';
import { StepTerritories } from './StepTerritories';
import { StepProducts } from './StepProducts';
import { StepRoute } from './StepRoute';
import { StepCommercial } from './StepCommercial';
import { StepReview } from './StepReview';

const OnboardingWizardPage: React.FC = () => {
  const { partnerId } = useParams();
  const [search] = useSearchParams();
  const presetType = search.get('type');
  const navigate = useNavigate();
  const data = useGtmBundle();
  const { actor, showToast } = useGtmAuth();
  const { run, pending, errors, setErrors } = useAction();

  const [state, setState] = useState<WizardState>({ id: null, input: emptyInput(), extras: emptyExtras() });
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const initialised = useRef(false);

  const existing = partnerId ? data.partners.find((p) => p.id === partnerId) : undefined;
  const editable = !existing || existing.status === 'Draft' || existing.status === 'KYC Pending';

  // Initialise: new → suggested code; existing → restore draft payload & step
  useEffect(() => {
    if (initialised.current || data.loading) return;
    if (partnerId) {
      if (!existing) return;
      initialised.current = true;
      const s = stateFromPartner(existing);
      if (!existing.onboarding) {
        // Re-submission (e.g. KYC Pending): rebuild selections from stored actual relationships
        s.extras.flowSelections = data.mappings.filter((m) => m.partnerId === existing.id).map((m) => {
          const o = data.overrides.find((x) => x.partnerId === existing.id && x.flowId === m.flowId && x.approvalStatus !== 'Rejected');
          return { flowId: m.flowId, suppliers: m.suppliers ? structuredClone(m.suppliers) : undefined, customers: m.customers ? structuredClone(m.customers) : undefined, route: m.route ? structuredClone(m.route) : undefined, ownStageId: m.ownStageId, supplierStageId: m.supplierStageId ?? null, supplyWarehouseId: m.supplyWarehouseId ?? null, stageAssignments: m.stageAssignments, skippedStageIds: o?.skippedStageIds ?? [], overrideReason: o?.reason ?? '' };
        });
      }
      setState(s);
      const st = Math.min(Math.max(existing.draftStep - 1, 0), STEPS.length - 1);
      setStep(existing.status === 'KYC Pending' ? STEP.KYC : st);
      setMaxReached(existing.status === 'KYC Pending' ? STEPS.length - 1 : st);
    } else {
      initialised.current = true;
      if (presetType) setState((s) => ({ ...s, input: { ...s.input, partnerTypeId: presetType } }));
      partnerService.suggestCode().then((code) => setState((s) => (s.input.code ? s : { ...s, input: { ...s.input, code } })));
    }
  }, [partnerId, existing, data.loading, data.mappings, data.overrides, presetType]);

  // Unsaved-change protection for reload / tab close
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = useCallback((fn: (s: WizardState) => WizardState) => { setState(fn); setDirty(true); }, []);

  if (data.error) return <ErrorState message={data.error} />;
  /** The onboarding wizard opens as a wide side drawer over the partner register. */
  const shell = (title: string, body: React.ReactNode) => (
    <>
      <PartnersPage />
      <Modal open size="xl" title={title} onClose={() => navigate(ROUTES.partners)}>{body}</Modal>
    </>
  );
  if (data.loading || !data.config) return shell('Partner onboarding', <LoadingState label="Loading onboarding workspace…" />);
  if (partnerId && !existing) return shell('Partner onboarding', <ErrorState message="Partner not found." onRetry={() => navigate(ROUTES.partners)} />);
  const config = data.config;

  if (existing && !editable) {
    return shell(existing.name,
      <Alert tone="info">This partner is <PartnerStatusBadge status={existing.status} config={config} /> and can no longer be edited through onboarding. <Link to={`${ROUTES.partners}?focus=${existing.id}`}>View partner details</Link>.</Alert>);
  }

  const goto = (i: number) => {
    if (i > step) {
      for (let s = step; s < i; s++) {
        const errs = validateStep(s, state, data.partners, data.flows, { channels: data.channels, config: data.config });
        if (errs.length) { setStep(s); setShowErrors(true); showToast(errs[0], 'warning'); return; }
      }
    }
    setShowErrors(false);
    setErrors([]);
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
  };

  const saveDraft = async (silent = false) => {
    const r = await run(() => partnerService.saveDraft(state.id, state.input, state.extras, Math.max(step, maxReached) + 1, actor), silent ? undefined : 'Draft saved.');
    if (r) {
      setDirty(false);
      if (!state.id) {
        setState((s) => ({ ...s, id: r.id }));
        if (!silent) navigate(ROUTES.onboardEdit(r.id), { replace: true });
      }
    }
    return r;
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const errs = validateStep(s, state, data.partners, data.flows, { channels: data.channels, config: data.config });
      if (errs.length) { setStep(s); setShowErrors(true); showToast(errs[0], 'warning'); return; }
    }
    const saved = await saveDraft(true);
    if (!saved) return;
    const res = await run(() => partnerService.submit(saved.id, actor));
    if (res) {
      setDirty(false);
      showToast(res.missingDocs.length
        ? `${res.partner.name} submitted as KYC Pending — missing: ${res.missingDocs.join(', ')}.`
        : `${res.partner.name} submitted — KYC verification requested.`, res.missingDocs.length ? 'warning' : 'success');
      navigate(`${ROUTES.partners}?focus=${res.partner.id}`);
    } else {
      setStep(STEPS.length - 1);
    }
  };

  const props = { state, update, data, config, showErrors };
  const stepErrors = showErrors ? validateStep(step, state, data.partners, data.flows, { channels: data.channels, config: data.config }) : [];

  const close = () => (dirty ? setLeaveOpen(true) : navigate(ROUTES.partners));

  return (
    <>
      <PartnersPage />
      <Modal
        open
        size="xl"
        onClose={close}
        title={state.input.name ? `Onboard: ${state.input.name}` : 'Onboard a new partner'}
        subtitle={existing ? <>Status: <PartnerStatusBadge status={existing.status} config={config} /> {dirty && <span className="g2-muted g2-small">· unsaved changes</span>}</> : dirty ? 'Unsaved changes' : 'Seven guided steps from basic details to submission.'}
        footer={<>
          <Button icon={<Save size={15} />} onClick={() => saveDraft()} loading={pending} disabled={!dirty && !!state.id}>Save draft</Button>
          <span className="g2-spacer" />
          <Button icon={<ArrowLeft size={15} />} disabled={step === 0} onClick={() => goto(step - 1)}>Previous</Button>
          {step < STEPS.length - 1
            ? <Button variant="primary" onClick={() => goto(step + 1)}>Next <ArrowRight size={15} /></Button>
            : <Button variant="primary" icon={<Send size={15} />} loading={pending} onClick={submit}>Submit onboarding</Button>}
        </>}
      >
      <Card>
        <Stepper steps={STEPS} current={step} maxReached={maxReached} onSelect={goto} />
      </Card>
      <div className="g2-mt">
        <Card title={`Step ${step + 1}. ${STEPS[step]}`}>
          {stepErrors.length > 0 && step !== STEP.BASIC && <div style={{ marginBottom: 12 }}><ErrorList errors={stepErrors} /></div>}
          {step === STEP.BASIC && <StepBasic {...props} />}
          {step === STEP.TERRITORIES && <StepTerritories {...props} />}
          {step === STEP.PRODUCTS && <StepProducts {...props} />}
          {step === STEP.ROUTE && <StepRoute {...props} />}
          {step === STEP.KYC && <StepKyc {...props} />}
          {step === STEP.COMMERCIAL && <StepCommercial {...props} />}
          {step === STEP.REVIEW && <StepReview {...props} onJump={goto} serverErrors={errors} />}
        </Card>
      </div>
      </Modal>
      <ConfirmDialog
        open={leaveOpen}
        title="Discard unsaved changes?"
        message="You have unsaved onboarding changes. Save a draft first, or leave and discard them."
        confirmLabel="Leave without saving"
        tone="danger"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => { setLeaveOpen(false); setDirty(false); navigate(ROUTES.partners); }}
      />
    </>
  );
};

export default OnboardingWizardPage;
