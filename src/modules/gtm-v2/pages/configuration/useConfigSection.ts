import { useEffect, useState } from 'react';
import type { GtmConfiguration } from '../../types';
import { configService } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';

/** Local editable copy of a configuration section with save / discard. */
export function useConfigSection<K extends keyof GtmConfiguration>(section: K, config: GtmConfiguration) {
  const source = config[section];
  const [draft, setDraft] = useState<GtmConfiguration[K]>(() => structuredClone(source));
  const { run, pending, errors, setErrors } = useAction();
  const { actor, can } = useGtmAuth();
  const sourceKey = JSON.stringify(source);

  // Re-sync when the persisted value changes (e.g. after save / reset).
  useEffect(() => { setDraft(JSON.parse(sourceKey)); }, [sourceKey]);

  const dirty = JSON.stringify(draft) !== sourceKey;
  const save = async (validate?: (v: GtmConfiguration[K]) => string[]) => {
    const local = validate?.(draft) ?? [];
    if (local.length) { setErrors(local); return; }
    await run(() => configService.update(section, draft, actor), 'Configuration saved. Applies to new transactions from now on.');
  };
  const discard = () => { setDraft(JSON.parse(sourceKey)); setErrors([]); };
  return { draft, setDraft, dirty, save, discard, pending, errors, readOnly: !can.manageConfig };
}

export { SectionShell } from './SectionShell';
