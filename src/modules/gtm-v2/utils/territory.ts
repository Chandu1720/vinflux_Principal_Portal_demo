import type { Territory, TerritoryLevelLabel, TerritoryNode } from '../types';

export const levelLabelFor = (depth: number, labels: TerritoryLevelLabel[]): string =>
  labels.find((l) => l.depth === depth)?.label ?? `Level ${depth + 1}`;

/** Build a forest of TerritoryNodes. Works for unlimited depth. */
export const buildTerritoryTree = (items: Territory[], labels: TerritoryLevelLabel[]): TerritoryNode[] => {
  const byParent = new Map<string | null, Territory[]>();
  const ids = new Set(items.map((t) => t.id));
  items.forEach((t) => {
    const key = t.parentId && ids.has(t.parentId) ? t.parentId : null;
    const arr = byParent.get(key) ?? [];
    arr.push(t);
    byParent.set(key, arr);
  });
  const visit = (parentId: string | null, depth: number, path: string[], guard: Set<string>): TerritoryNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((t) => !guard.has(t.id))
      .map((t) => {
        const nextGuard = new Set(guard).add(t.id);
        const p = [...path, t.name];
        return { ...t, depth, levelLabel: levelLabelFor(depth, labels), path: p, children: visit(t.id, depth + 1, p, nextGuard) };
      });
  return visit(null, 0, [], new Set());
};

export const flattenTree = (nodes: TerritoryNode[]): TerritoryNode[] =>
  nodes.flatMap((n) => [n, ...flattenTree(n.children)]);

export const getDescendantIds = (id: string, items: Territory[]): string[] => {
  const out: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    items.forEach((t) => {
      if (t.parentId === cur && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t.id);
        stack.push(t.id);
      }
    });
  }
  return out;
};

export const getAncestorIds = (id: string, items: Territory[]): string[] => {
  const map = new Map(items.map((t) => [t.id, t]));
  const out: string[] = [];
  let cur = map.get(id)?.parentId ?? null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = map.get(cur)?.parentId ?? null;
  }
  return out;
};

export const getDepth = (id: string, items: Territory[]): number => getAncestorIds(id, items).length;

export const territoryPath = (id: string, items: Territory[]): string => {
  const map = new Map(items.map((t) => [t.id, t]));
  const names = [...getAncestorIds(id, items)].reverse().map((a) => map.get(a)?.name ?? '');
  const self = map.get(id);
  return [...names, self?.name ?? id].filter(Boolean).join(' › ');
};

/** True when setting `parentId` as the parent of `id` would create a cycle. */
export const wouldCreateCycle = (id: string, parentId: string | null, items: Territory[]): boolean => {
  if (!parentId) return false;
  if (parentId === id) return true;
  return getDescendantIds(id, items).includes(parentId);
};

/** Expand a set of territory ids to include all descendants. */
export const expandWithDescendants = (ids: string[], items: Territory[]): Set<string> => {
  const out = new Set<string>(ids);
  ids.forEach((id) => getDescendantIds(id, items).forEach((d) => out.add(d)));
  return out;
};

/**
 * Two territory sets "overlap" if they share an id, or (hierarchy mode)
 * one contains an ancestor / descendant of the other.
 */
export const territoriesOverlap = (a: string[], b: string[], items: Territory[], mode: 'exact' | 'hierarchy'): boolean => {
  if (!a.length || !b.length) return false;
  if (mode === 'exact') return a.some((x) => b.includes(x));
  const aExpanded = expandWithDescendants(a, items);
  const bExpanded = expandWithDescendants(b, items);
  return [...aExpanded].some((x) => bExpanded.has(x));
};

/** Collapse a selection to its top-most selected nodes (for compact display). */
export const collapseSelection = (ids: string[], items: Territory[]): string[] => {
  const set = new Set(ids);
  return ids.filter((id) => !getAncestorIds(id, items).some((a) => set.has(a)));
};

/** Data-scope check for the signed-in user: empty scope = everything; otherwise the record must sit in (or under) a scoped territory. */
export const scopeMatcher = (scope: string[], items: Territory[]) => {
  if (!scope.length) return () => true;
  const s = expandWithDescendants(scope, items);
  return (ids: string[]) => ids.some((t) => s.has(t));
};
