export const formatINR = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const formatCompactINR = (n: number): string => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)} L`;
  return formatINR(n);
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatCommercial = (kind: 'pct' | 'days' | 'money' | 'bool', v: unknown): string => {
  if (v === null || v === undefined) return '—';
  switch (kind) {
    case 'pct': return `${v}%`;
    case 'days': return `${v} days`;
    case 'money': return formatINR(Number(v));
    case 'bool': return v ? 'Yes' : 'No';
  }
};

export const formatBytes = (b: number): string => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const includesText = (haystack: (string | null | undefined)[], needle: string): boolean => {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystack.some((h) => (h ?? '').toLowerCase().includes(n));
};
