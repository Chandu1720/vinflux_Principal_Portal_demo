import { useCallback, useState } from 'react';
import { errorMessage, ServiceError } from '../services/apiClient';
import { useApp } from '../../../context/AppContext.tsx';

/**
 * Wraps a service mutation with pending state, error capture and toast feedback.
 * Returns the result, or undefined if the action failed.
 */
export const useAction = () => {
  const { showToast } = useApp();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setPending(true);
    setErrors([]);
    try {
      const r = await fn();
      if (success) showToast(typeof success === 'function' ? success(r) : success, 'success');
      return r;
    } catch (e) {
      const list = e instanceof ServiceError && e.details?.length ? e.details : [errorMessage(e)];
      setErrors(list);
      showToast(list[0], 'danger');
      return undefined;
    } finally {
      setPending(false);
    }
  }, [showToast]);

  return { run, pending, errors, setErrors };
};
