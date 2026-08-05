import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Tests the vote-toggle behavior of PageFeedback.astro.
 *
 * Mirrors the component's inline script: clicking Yes/No persists the vote
 * to localStorage, hides the prompt, shows the thank-you state, and
 * disables the buttons. A page loaded with an existing vote renders the
 * voted state immediately.
 */

const WIDGET_HTML = `
  <div class="page-feedback" data-page-feedback data-path="/topics/test/">
    <div class="page-feedback-prompt" data-feedback-prompt>
      <button data-feedback-vote="yes">Yes</button>
      <button data-feedback-vote="no">No</button>
    </div>
    <div class="page-feedback-thanks" data-feedback-thanks hidden>
      <span data-feedback-thanks-text></span>
      <a data-feedback-issue hidden>Issue</a>
    </div>
  </div>
`;

const STORAGE_KEY = 'jmeter-docs-feedback:v1';

function attachFeedbackHandlers(document) {
  const readVotes = () => {
    try {
      const raw = document.defaultView.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };
  const writeVote = (path, vote) => {
    const votes = readVotes();
    votes[path] = vote;
    document.defaultView.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  };
  const applyVotedState = (widget, vote) => {
    const prompt = widget.querySelector('[data-feedback-prompt]');
    const thanks = widget.querySelector('[data-feedback-thanks]');
    const thanksText = widget.querySelector('[data-feedback-thanks-text]');
    const issueLink = widget.querySelector('[data-feedback-issue]');
    if (!prompt || !thanks) return;
    prompt.hidden = true;
    thanks.hidden = false;
    if (thanksText) {
      thanksText.textContent =
        vote === 'yes'
          ? 'Thanks for the feedback!'
          : "Thanks for the feedback. We'll improve this page.";
    }
    if (issueLink) issueLink.hidden = vote !== 'no';
    widget.querySelectorAll('[data-feedback-vote]').forEach((btn) => {
      btn.setAttribute('disabled', '');
    });
  };
  document.querySelectorAll('[data-page-feedback]').forEach((widget) => {
    const path = widget.dataset.path || document.defaultView.location.pathname;
    const existing = readVotes()[path];
    if (existing === 'yes' || existing === 'no') {
      applyVotedState(widget, existing);
      return;
    }
    widget.querySelectorAll('[data-feedback-vote]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vote = btn.dataset.feedbackVote;
        if (vote !== 'yes' && vote !== 'no') return;
        writeVote(path, vote);
        applyVotedState(widget, vote);
      });
    });
  });
}

describe('PageFeedback vote toggle', () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM(WIDGET_HTML, { url: 'http://localhost/topics/test/' });
  });

  afterEach(() => {
    dom?.window.close();
  });

  it('shows the prompt and hides the thank-you state initially', () => {
    const doc = dom.window.document;
    expect(doc.querySelector('[data-feedback-prompt]').hidden).toBe(false);
    expect(doc.querySelector('[data-feedback-thanks]').hidden).toBe(true);
  });

  it('clicking Yes hides the prompt, shows thanks, disables buttons, and persists the vote', () => {
    const doc = dom.window.document;
    attachFeedbackHandlers(doc);

    doc.querySelector('[data-feedback-vote="yes"]').click();

    expect(doc.querySelector('[data-feedback-prompt]').hidden).toBe(true);
    expect(doc.querySelector('[data-feedback-thanks]').hidden).toBe(false);
    expect(doc.querySelector('[data-feedback-thanks-text]').textContent).toBe(
      'Thanks for the feedback!',
    );
    expect(doc.querySelector('[data-feedback-issue]').hidden).toBe(true);
    expect(doc.querySelector('[data-feedback-vote="yes"]').hasAttribute('disabled')).toBe(true);
    expect(doc.querySelector('[data-feedback-vote="no"]').hasAttribute('disabled')).toBe(true);

    const stored = JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
    expect(stored['/topics/test/']).toBe('yes');
  });

  it('clicking No surfaces the GitHub issue link', () => {
    const doc = dom.window.document;
    attachFeedbackHandlers(doc);

    doc.querySelector('[data-feedback-vote="no"]').click();

    expect(doc.querySelector('[data-feedback-issue]').hidden).toBe(false);
    const stored = JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY));
    expect(stored['/topics/test/']).toBe('no');
  });

  it('restores the voted state on load without further clicks', () => {
    dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ '/topics/test/': 'no' }));
    const doc = dom.window.document;
    attachFeedbackHandlers(doc);

    expect(doc.querySelector('[data-feedback-prompt]').hidden).toBe(true);
    expect(doc.querySelector('[data-feedback-thanks]').hidden).toBe(false);
    expect(doc.querySelector('[data-feedback-issue]').hidden).toBe(false);
  });
});
