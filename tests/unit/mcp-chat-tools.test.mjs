import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/pages/api/mcp.ts';
import {
  buildChatSystemPrompt,
  createMcpChatSession,
  mcpChatStreamBindings,
  mcpToolResultToText,
  CHAT_MAX_TOOL_STEPS,
  MCP_TOOL_NAMES,
} from '../../src/lib/mcp-chat-tools.mjs';

const toolOptions = { messages: [], toolCallId: 'test-call' };

/** @type {Awaited<ReturnType<typeof createMcpChatSession>> | undefined} */
let session;

afterEach(async () => {
  await session?.close();
  session = undefined;
});

describe('mcpToolResultToText', () => {
  it('joins MCP text content parts', () => {
    expect(
      mcpToolResultToText({
        content: [{ type: 'text', text: 'hello' }, { type: 'text', text: 'world' }],
      }),
    ).toBe('hello\nworld');
  });

  it('prefixes MCP isError results', () => {
    expect(
      mcpToolResultToText({
        isError: true,
        content: [{ type: 'text', text: 'not found' }],
      }),
    ).toBe('Tool error: not found');
  });
});

describe('buildChatSystemPrompt', () => {
  it('instructs the model to use MCP tools instead of stuffed RAG context', () => {
    const prompt = buildChatSystemPrompt();
    expect(prompt).toContain('JMeter Docs AI assistant');
    expect(prompt).toContain('search_jmeter_docs');
    expect(prompt).toContain('get_jmeter_page');
    expect(prompt).toContain('calculate_workload_model');
    expect(prompt).not.toContain('DOCUMENTATION CONTEXT');
  });

  it('pins the current docs page when pagePath is a known chunk', () => {
    const prompt = buildChatSystemPrompt({ pagePath: '/tools/thread-calculator/' });
    expect(prompt).toContain('currently reading');
    expect(prompt).toContain('thread-calculator');
    expect(prompt).toContain('get_jmeter_page');
  });
});

describe('createMcpChatSession', () => {
  it('exposes the same tools advertised by GET /api/mcp', async () => {
    session = await createMcpChatSession();
    const advertised = await GET({
      request: new Request('https://docs.jmeter.ai/api/mcp', {
        headers: { Accept: 'application/json' },
      }),
    }).then((res) => res.json());
    expect([...session.toolNames].sort()).toEqual([...advertised.tools].sort());
    expect(session.toolNames).toEqual(expect.arrayContaining(MCP_TOOL_NAMES));
    for (const name of MCP_TOOL_NAMES) {
      expect(typeof session.tools[name]?.execute).toBe('function');
    }
  });

  it('runs search_jmeter_docs against the real chunk index', async () => {
    session = await createMcpChatSession();
    const text = await session.tools.search_jmeter_docs.execute(
      { query: 'thread group ramp up' },
      toolOptions,
    );
    expect(text).toContain('docs.jmeter.ai');
    expect(text).toMatch(/URL:/);
  });

  it('runs get_jmeter_page for a known path', async () => {
    session = await createMcpChatSession();
    const text = await session.tools.get_jmeter_page.execute(
      { url: 'getting-started/get-started' },
      toolOptions,
    );
    expect(text).toContain('Source: https://docs.jmeter.ai/');
    expect(text).toContain('# ');
  });

  it('runs calculate_workload_model', async () => {
    session = await createMcpChatSession();
    const text = await session.tools.calculate_workload_model.execute(
      { targetRps: 50, avgResponseTimeMs: 200 },
      toolOptions,
    );
    const parsed = JSON.parse(text);
    expect(parsed.summary.recommendedThreads).toBeGreaterThan(0);
  });

  it('caps the Ask AI tool loop at five Gemini steps so a final answer can stream', () => {
    expect(CHAT_MAX_TOOL_STEPS).toBe(5);
  });
});

describe('mcpChatStreamBindings', () => {
  it('wires stopWhen, tools, and session close on end/abort/error', async () => {
    const close = vi.fn();
    const tools = { search_jmeter_docs: { execute: () => 'ok' } };
    const bindings = mcpChatStreamBindings({ tools, close });
    expect(bindings.tools).toBe(tools);
    expect(await bindings.stopWhen({ steps: [{}, {}, {}, {}] })).toBe(false);
    expect(await bindings.stopWhen({ steps: [{}, {}, {}, {}, {}] })).toBe(true);
    await bindings.onEnd();
    await bindings.onAbort();
    await bindings.onError();
    expect(close).toHaveBeenCalledTimes(3);
  });
});
