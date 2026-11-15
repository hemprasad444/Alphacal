// complete(): what is sent to OpenRouter, and how its answer (streamed or not) is read back.
jest.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => 'test-key' }), defineString: (_: string, o: { default: string }) => ({ value: () => o.default }) }));

// eslint-disable-next-line import/first
import { complete, LlmError } from '../src/llm';

type Call = { url: string; body: Record<string, any> };
const calls: Call[] = [];
let answers: (() => Response | Promise<Response>)[] = [];

beforeEach(() => {
  calls.length = 0;
  answers = [];
  global.fetch = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const next = answers.shift();
    if (!next) throw new Error('no answer queued');
    return next();
  }) as unknown as typeof fetch;
});

const json = (o: unknown, status = 200) => () => new Response(JSON.stringify(o), { status });
const sse = (...lines: string[]) => () => new Response(lines.map(l => `${l}\n`).join(''), { status: 200 });
const data = (o: unknown) => `data: ${JSON.stringify(o)}`;
const ask = { task: 'fast' as const, system: 'You are REI.', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 100 };

describe('complete', () => {
  it('sends the model list for the job, with the tools, and reads a plain answer', async () => {
    answers = [json({ model: 'openai/gpt-6-luna', choices: [{ finish_reason: 'stop', message: { content: 'Hello.' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })];
    const r = await complete({ ...ask, tools: [{ name: 'log_meal', description: 'd', input_schema: { type: 'object' } }] });
    expect(r).toEqual({ content: [{ type: 'text', text: 'Hello.' }], stop_reason: 'end_turn', model: 'openai/gpt-6-luna', usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0 } });
    const b = calls[0].body;
    expect([b.model, b.models, b.stream, b.reasoning.effort]).toEqual(['openai/gpt-6-luna', ['openai/gpt-6-luna', 'google/gemini-3.8-flash'], false, 'none']);
    expect(b.messages[0]).toEqual({ role: 'system', content: 'You are REI.' });
    expect(b.tools[0].function.name).toBe('log_meal');
  });
  it('reads a streamed reply with a tool call split across chunks, skipping keep-alives and a garbled line', async () => {
    const seen: string[] = [];
    answers = [sse(
      ': OPENROUTER PROCESSING',
      data({ model: 'openai/gpt-6-luna', choices: [{ delta: { content: 'Good ' } }] }),
      'data: {"choices":[{"delta":{"content":"oops"',
      data({ choices: [{ delta: { content: 'lunch.' } }] }),
      data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'log_meal', arguments: '{"name":"Dal' } }] } }] }),
      data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' rice","items":[]}' } }] }, finish_reason: 'tool_calls' }] }),
      data({ choices: [], usage: { prompt_tokens: 50, completion_tokens: 9, prompt_tokens_details: { cached_tokens: 40 } } }),
      'data: [DONE]',
    )];
    const r = await complete({ ...ask, onText: d => seen.push(d) });
    expect(seen).toEqual(['Good ', 'lunch.']);
    expect(r.content).toEqual([{ type: 'text', text: 'Good lunch.' }, { type: 'tool_use', name: 'log_meal', input: { name: 'Dal rice', items: [] } }]);
    expect([r.stop_reason, r.usage.cache_read_input_tokens]).toEqual(['tool_use', 40]);
    expect(calls[0].body.stream).toBe(true);
  });
  it('drops a tool call cut off mid-JSON but keeps the words', async () => {
    answers = [sse(data({ choices: [{ delta: { content: 'So' } }] }), data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'log_meal', arguments: '{"name":"Da' } }] }, finish_reason: 'length' }] }))];
    const r = await complete({ ...ask, onText: () => undefined });
    expect(r.content).toEqual([{ type: 'text', text: 'So' }]);
    expect(r.stop_reason).toBe('max_tokens');
  });
  it('tries again when the connection fails or the provider is overloaded', async () => {
    answers = [() => Promise.reject(new Error('socket hang up')), json({ error: 'busy' }, 503), json({ choices: [{ finish_reason: 'stop', message: { content: 'Third time.' } }] })];
    const r = await complete(ask);
    expect(r.content).toEqual([{ type: 'text', text: 'Third time.' }]);
    expect(calls).toHaveLength(3);
  });
  it('gives up with an error the chat can explain', async () => {
    answers = [() => Promise.reject(new Error('down')), () => Promise.reject(new Error('down')), () => Promise.reject(new Error('still down'))];
    await expect(complete(ask)).rejects.toMatchObject({ status: 503, message: 'OpenRouter unreachable: still down' });
    answers = [json({ error: 'bad key' }, 401)];
    const e = await complete(ask).catch(x => x);
    expect(e).toBeInstanceOf(LlmError);
    expect(e.status).toBe(401);
    // A 4xx isn't retried.
    expect(calls).toHaveLength(4);
  });
  it('asks for the least thinking when a model refuses none', async () => {
    answers = [json({ error: 'reasoning required' }, 400), json({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] })];
    await complete(ask);
    expect(calls.map(c => c.body.reasoning.effort)).toEqual(['none', 'minimal']);
  });
  it('raises an error sent inside the stream', async () => {
    answers = [sse(data({ choices: [{ delta: { content: 'Hal' } }] }), data({ error: { message: 'provider died', code: 502 } }))];
    await expect(complete({ ...ask, onText: () => undefined })).rejects.toMatchObject({ message: 'provider died', status: 502 });
  });
  it('uses one named model alone for a retry on the backup', async () => {
    answers = [json({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] })];
    await complete({ ...ask, model: 'google/gemini-3.8-flash', forceTool: 'log_meal' });
    expect([calls[0].body.model, calls[0].body.models, calls[0].body.tool_choice]).toEqual(['google/gemini-3.8-flash', undefined, { type: 'function', function: { name: 'log_meal' } }]);
  });
});
