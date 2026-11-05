/**
 * Platform event bus. Modules never call each other directly: they publish events
 * ("stock.received", "order.dispatched", "recall.started") and other modules subscribe.
 * INTEGRATION POINT: in production this becomes a message queue / webhook outbox.
 */
import { loadJson, newId, saveJson } from './store';

export type PlatformEventType =
  | 'module.enabled' | 'module.disabled'
  | 'product.imported'
  | 'stock.received' | 'stock.reversed'
  | 'import.completed' | 'import.undone'
  | 'connector.synced' | 'connector.failed'
  | 'user.changed' | 'role.changed'
  | 'price.submitted' | 'price.activated' | 'price.rejected';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  at: string;
  by: string;
  source: string;
  summary: string;
  data?: Record<string, unknown>;
}

const KEY = 'vinflux.events.v1';
type Handler = (e: PlatformEvent) => void;
const handlers = new Map<string, Set<Handler>>();

export const getEventLog = (): PlatformEvent[] => loadJson<PlatformEvent[]>(KEY, []);

export const emit = (type: PlatformEventType, source: string, by: string, summary: string, data?: Record<string, unknown>) => {
  const e: PlatformEvent = { id: newId('evt'), type, at: new Date().toISOString(), by, source, summary, data };
  saveJson(KEY, [e, ...getEventLog()].slice(0, 200));
  [...(handlers.get(type) ?? []), ...(handlers.get('*') ?? [])].forEach((h) => { try { h(e); } catch { /* a subscriber must never break the publisher */ } });
  return e;
};

/** Subscribe to one event type or '*' for all. Returns an unsubscribe function. */
export const on = (type: PlatformEventType | '*', h: Handler) => {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(h);
  return () => handlers.get(type)?.delete(h);
};
