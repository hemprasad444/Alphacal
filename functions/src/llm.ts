import { defineSecret, defineString } from 'firebase-functions/params';

/** Set with: firebase functions:secrets:set OPENROUTER_API_KEY */
export const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');

/**
 * One model setting per job, in functions/.env.<project-id>. A comma-separated list
 * is tried in order, so the next model answers when the first is down or overloaded.
 * Model ids: https://openrouter.ai/models
 */
export type Task = 'fast' | 'deep' | 'photo' | 'program' | 'report';

const DEFAULTS: Record<Task, { env: string; models: string }> = {
  /** Quick chat, meal text, check-ins. */
  fast: { env: 'LLM_FAST', models: 'openai/gpt-6-luna,google/gemini-3.8-flash' },
  /** Planning and analysis in chat. */
  deep: { env: 'LLM_DEEP', models: 'anthropic/claude-sonnet-5.5,openai/gpt-6.1-sol' },
  /** Meal photos: needs vision. */
  photo: { env: 'LLM_PHOTO', models: 'google/gemini-3.8-flash,openai/gpt-6-luna' },
  /** The weekly training program. */
  program: { env: 'LLM_PROGRAM', models: 'anthropic/claude-sonnet-5.5,openai/gpt-6.1-sol' },
  /** The weekly report. */
  report: { env: 'LLM_REPORT', models: 'openai/gpt-6-luna,google/gemini-3.8-flash' },
};

const SETTING = Object.fromEntries(Object.entries(DEFAULTS).map(([k, d]) => [k, defineString(d.env, { default: d.models })])) as Record<Task, ReturnType<typeof defineString>>;

export interface LlmTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export type Block = { type: 'text'; text: string } | { type: 'tool_use'; name: string; input: unknown };

export interface LlmResult {
  content: Block[];
  stop_reason: 'end_turn' | 'max_tokens' | 'refusal' | 'tool_use';
  /** The model that actually answered (after any fallback). */
  model: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number };
}

export interface CompleteOpts {
  task: Task;
  system: string;
  messages: Msg[];
  maxTokens: number;
  tools?: LlmTool[];
  /** Force this tool to be called. */
  forceTool?: string;
  /** JSON Schema the reply must follow. */
  json?: object;
  /** Base64 JPEG attached to the last user message. */
  image?: string;
  /** Called with each piece of text as it streams; turns streaming on. */
  onText?: (delta: string) => void;
}

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const FINISH: Record<string, LlmResult['stop_reason']> = { stop: 'end_turn', length: 'max_tokens', tool_calls: 'tool_use', content_filter: 'refusal' };

interface Chunk {
  model?: string;
  error?: { message?: string; code?: number };
  choices?: { finish_reason?: string | null; delta?: { content?: string | null; tool_calls?: { index: number; function?: { name?: string; arguments?: string } }[] }; message?: { content?: string | null; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
}

export async function complete(o: CompleteOpts): Promise<LlmResult> {
  const models = (SETTING[o.task].value() || DEFAULTS[o.task].models).split(',').map(s => s.trim()).filter(Boolean);
  const last = o.messages.length - 1;
  const body = {
    model: models[0],
    ...(models.length > 1 ? { models } : {}),
    max_tokens: o.maxTokens,
    stream: !!o.onText,
    usage: { include: true },
    // Only providers that support the tools / JSON schema asked for.
    provider: { require_parameters: true },
    messages: [
      { role: 'system', content: o.system },
      ...o.messages.map((m, i) =>
        i === last && o.image && m.role === 'user'
          ? { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${o.image}` } }, { type: 'text', text: m.content }] }
          : m,
      ),
    ],
    ...(o.tools?.length ? { tools: o.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
    ...(o.forceTool ? { tool_choice: { type: 'function', function: { name: o.forceTool } } } : {}),
    ...(o.json ? { response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: o.json } } } : {}),
  };

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY.value()}`, 'Content-Type': 'application/json', 'X-Title': 'REI' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110_000),
    });
    if (res.ok || (res.status !== 429 && res.status < 500)) break;
    await new Promise(r => setTimeout(r, 400));
  }
  if (!res || !res.ok) throw new LlmError(`OpenRouter ${res?.status}: ${(await res?.text())?.slice(0, 300)}`, res?.status);

  let text = '';
  const calls: { name: string; args: string }[] = [];
  let finish = 'stop', model = models[0], usage: Chunk['usage'];

  const take = (c: Chunk) => {
    if (c.error) throw new LlmError(c.error.message ?? 'OpenRouter error', c.error.code);
    if (c.model) model = c.model;
    if (c.usage) usage = c.usage;
    const ch = c.choices?.[0];
    if (!ch) return;
    if (ch.finish_reason) finish = ch.finish_reason;
    const d = ch.delta ?? ch.message;
    if (d?.content) {
      text += d.content;
      if (o.onText && ch.delta) o.onText(d.content);
    }
    for (const [i, t] of (ch.delta?.tool_calls ?? []).entries()) {
      const k = t.index ?? i;
      calls[k] ??= { name: '', args: '' };
      if (t.function?.name) calls[k].name += t.function.name;
      if (t.function?.arguments) calls[k].args += t.function.arguments;
    }
    for (const t of ch.message?.tool_calls ?? []) calls.push({ name: t.function.name, args: t.function.arguments });
  };

  if (o.onText && res.body) {
    const dec = new TextDecoder();
    let buf = '';
    for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += dec.decode(part, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue; // ": OPENROUTER PROCESSING" keep-alives
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') take(JSON.parse(data) as Chunk);
      }
    }
  } else {
    take((await res.json()) as Chunk);
  }

  const content: Block[] = [];
  if (text) content.push({ type: 'text', text });
  for (const c of calls) {
    if (!c?.name) continue;
    try {
      content.push({ type: 'tool_use', name: c.name, input: c.args ? JSON.parse(c.args) : {} });
    } catch {
      // A tool call cut off mid-JSON: keep the text, drop the call.
    }
  }
  return {
    content,
    stop_reason: calls.length && finish === 'stop' ? 'tool_use' : (FINISH[finish] ?? 'end_turn'),
    model,
    usage: { input_tokens: usage?.prompt_tokens ?? 0, output_tokens: usage?.completion_tokens ?? 0, cache_read_input_tokens: usage?.prompt_tokens_details?.cached_tokens ?? 0 },
  };
}

/** The text of a reply, with any code fence around JSON removed. */
export function jsonText(res: LlmResult): string {
  const t = res.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
  return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}
