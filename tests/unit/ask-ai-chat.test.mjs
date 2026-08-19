/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installChatDom() {
  document.body.innerHTML = `
    <div data-slot="doc-title"><h1>Best Practices</h1></div>
    <button id="ask-ai-trigger"></button>
    <section id="ask-ai-panel">
      <button id="ask-ai-close"></button>
      <button id="ask-ai-clear"></button>
      <button id="ask-ai-share" disabled></button>
      <div id="ask-ai-body"></div>
      <div id="ask-ai-empty">
        <button id="ask-ai-this-page" class="ask-ai-suggestion ask-ai-suggestion--page" hidden>
          <span data-this-page-label>Explain this page</span>
        </button>
      </div>
      <div id="ask-ai-messages"></div>
      <textarea id="ask-ai-input"></textarea>
      <button id="ask-ai-send"></button>
      <div id="ask-ai-error"></div>
    </section>
  `;
  document.querySelector('#ask-ai-body').scrollTo = vi.fn();
}

function stubLocalStorage() {
  const store = new Map();
  const memory = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('localStorage', memory);
}

describe('Ask AI share button state', () => {
  beforeEach(() => {
    vi.resetModules();
    stubLocalStorage();
    installChatDom();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    document.body.innerHTML = '';
  });

  it('enables sharing after a canned answer and disables it after clearing', async () => {
    await import('../../src/scripts/ask-ai-chat.ts');

    const input = document.querySelector('#ask-ai-input');
    const send = document.querySelector('#ask-ai-send');
    const share = document.querySelector('#ask-ai-share');
    const clear = document.querySelector('#ask-ai-clear');

    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    send.click();
    expect(share.disabled).toBe(false);

    clear.click();
    expect(share.disabled).toBe(true);
  });

  it('enables sharing after a streamed answer completes', async () => {
    const chunks = [
      'A JMeter **Thread Group** ',
      'defines virtual users and ramp-up.',
    ];
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/chat-count') {
        return new Response(JSON.stringify({ count: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url !== '/api/chat') throw new Error(`Unexpected fetch: ${url}`);

      const body = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Grounded': 'true',
          'X-Sources': encodeURIComponent('Thread Group|/user-manual/build-test-plan/'),
          'X-Chat-Count': '42',
        },
      });
    });

    await import('../../src/scripts/ask-ai-chat.ts');

    const input = document.querySelector('#ask-ai-input');
    const send = document.querySelector('#ask-ai-send');
    const share = document.querySelector('#ask-ai-share');

    input.value = 'How do I configure a Thread Group?';
    input.dispatchEvent(new Event('input'));
    send.click();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(share.disabled).toBe(true);
    await vi.waitFor(() => expect(share.disabled).toBe(false));

    const chatCall = global.fetch.mock.calls.find((call) => call[0] === '/api/chat');
    const payload = JSON.parse(chatCall[1].body);
    expect(payload).toHaveProperty('pagePath');
  });

  it('sends the current docs path as pagePath', async () => {
    window.history.pushState({}, '', '/user-manual/best-practices/');
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/chat-count') {
        return new Response(JSON.stringify({ count: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('ok', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    });

    await import('../../src/scripts/ask-ai-chat.ts');

    const input = document.querySelector('#ask-ai-input');
    const send = document.querySelector('#ask-ai-send');
    input.value = 'Summarize the key points';
    input.dispatchEvent(new Event('input'));
    send.click();

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    ));
    const chatCall = global.fetch.mock.calls.find((call) => call[0] === '/api/chat');
    const payload = JSON.parse(chatCall[1].body);
    expect(payload.pagePath).toBe('/user-manual/best-practices');
  });
});

describe('Ask AI this-page helpers', () => {
  it('rejects home, legal, and shared paths', async () => {
    const { isAskableDocPath, buildThisPagePrompt } = await import('../../src/scripts/ask-ai-chat.ts');
    expect(isAskableDocPath('/')).toBe(false);
    expect(isAskableDocPath('/legal/disclaimer')).toBe(false);
    expect(isAskableDocPath('/shared/abc')).toBe(false);
    expect(isAskableDocPath('/tools/cli-builder/')).toBe(true);
    expect(buildThisPagePrompt('CLI Command Builder', '/tools/cli-builder/')).toContain(
      'Explain this page: CLI Command Builder (/tools/cli-builder)',
    );
  });
});
