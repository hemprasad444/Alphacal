// Client for the REI backend. expo/fetch streams response bodies on iOS, which the
// built-in React Native fetch cannot.
import { fetch } from 'expo/fetch';
import { fb, functionsUrl } from './firebase';

export interface ChatRequest {
  text: string;
  mode: 'chat' | 'meal';
  replyId: string;
  userMessageId?: string;
  /** Voice mode: REI writes for the ear and may add [audio tags]. */
  voice?: boolean;
}

export interface ChatDone {
  id: string;
  text: string;
  notes: string[];
  model: string;
  tier: 'fast' | 'deep';
  ttftMs: number;
  totalMs: number;
}

export class ChatError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Event = { type: 'delta'; text: string } | ({ type: 'done' } & ChatDone) | { type: 'error'; message: string };

/**
 * Send one message and stream REI's reply. `onDelta` receives text as it arrives;
 * the promise resolves with the stored reply once the server has saved it.
 */
export async function streamChat(req: ChatRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<ChatDone> {
  const token = await fb().auth.currentUser?.getIdToken();
  if (!token) throw new ChatError(401, 'Not signed in.');
  const res = await fetch(functionsUrl('chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // Not JSON; keep the status.
    }
    throw new ChatError(res.status, message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const line = frame.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      const ev = JSON.parse(line.slice(6)) as Event;
      if (ev.type === 'delta') onDelta(ev.text);
      else if (ev.type === 'done') return ev;
      else throw new ChatError(502, ev.message);
    }
  }
  throw new ChatError(502, 'The reply was cut off.');
}
