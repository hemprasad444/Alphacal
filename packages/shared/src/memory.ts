// What REI remembers about you for good: diet, injuries, schedule, equipment, likes and
// dislikes. Kept on the user document and given to REI in chat, check-ins, programs
// and reports. You can see and edit the list in Settings.

export const MEMORY_KINDS = ['diet', 'health', 'schedule', 'equipment', 'preference', 'life'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface MemoryItem {
  id: string;
  text: string;
  kind: MemoryKind;
  createdAt: number;
  /** Learned by REI in conversation, or added by you. */
  source: 'rei' | 'you';
}

export const MAX_MEMORY = 30;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Add facts, skipping ones already known. At the limit, the oldest of REI's own notes make room. */
export function addMemory(list: MemoryItem[], facts: { text: string; kind: MemoryKind }[], source: MemoryItem['source'], now: number, newId: () => string): { list: MemoryItem[]; added: MemoryItem[] } {
  let next = [...list];
  const added: MemoryItem[] = [];
  for (const f of facts) {
    const text = f.text.trim().replace(/\s+/g, ' ').slice(0, 160);
    const n = norm(text);
    if (!n || next.some(m => norm(m.text) === n)) continue;
    const item: MemoryItem = { id: newId(), text, kind: MEMORY_KINDS.includes(f.kind) ? f.kind : 'life', createdAt: now, source };
    next.push(item);
    added.push(item);
  }
  while (next.length > MAX_MEMORY) {
    const i = next.findIndex(m => m.source === 'rei');
    next = next.filter((_, k) => k !== (i >= 0 ? i : 0));
  }
  return { list: next, added: added.filter(a => next.includes(a)) };
}

export function forgetMemory(list: MemoryItem[], ids: string[]): { list: MemoryItem[]; removed: MemoryItem[] } {
  const set = new Set(ids);
  return { list: list.filter(m => !set.has(m.id)), removed: list.filter(m => set.has(m.id)) };
}

/** For REI's prompt: one line per fact, with the id REI uses to forget it. */
export function memoryLines(list: MemoryItem[]): string {
  return list.map(m => `[${m.id}] (${m.kind}) ${m.text}`).join('\n');
}

/** One line, for programs and reports. */
export function memorySummary(list: MemoryItem[]): string {
  return list.map(m => m.text).join('; ');
}

/** Read the user document's field, dropping anything malformed. */
export function readMemory(raw: unknown): MemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is MemoryItem => !!m && typeof m === 'object' && typeof (m as MemoryItem).id === 'string' && typeof (m as MemoryItem).text === 'string')
    .map((m): MemoryItem => ({ ...m, kind: MEMORY_KINDS.includes(m.kind) ? m.kind : 'life', source: m.source === 'you' ? 'you' : 'rei', createdAt: Number(m.createdAt) || 0 }))
    .slice(0, MAX_MEMORY);
}
