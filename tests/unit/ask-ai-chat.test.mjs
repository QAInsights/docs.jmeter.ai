/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

function installChatDom() {
  document.body.innerHTML = `
    <button id="ask-ai-trigger"></button>
    <section id="ask-ai-panel">
      <button id="ask-ai-close"></button>
      <button id="ask-ai-clear"></button>
      <button id="ask-ai-share" disabled></button>
      <div id="ask-ai-body"></div>
      <div id="ask-ai-empty"></div>
      <div id="ask-ai-messages"></div>
      <textarea id="ask-ai-input"></textarea>
      <button id="ask-ai-send"></button>
      <div id="ask-ai-error"></div>
    </section>
  `;
  document.querySelector('#ask-ai-body').scrollTo = vi.fn();
}

describe('Ask AI share button state', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    installChatDom();
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
  });
});
