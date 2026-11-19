import { useEffect, useState } from 'react';
/** Re-render when a store notifies (stores expose subscribe(listener) → unsubscribe). */
export const useSubscribe = (...subscribers: ((l: () => void) => () => void)[]) => {
  const [, set] = useState(0);
  useEffect(() => {
    const offs = subscribers.map((s) => s(() => set((x) => x + 1)));
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
