import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Tests the mobile-search-btn click handler extracted from CustomHeader.astro.
 *
 * The script under test:
 *   document.querySelector('.mobile-search-btn')?.addEventListener('click', () => {
 *       const docSearchBtn = document.querySelector('.DocSearch-Button');
 *       if (docSearchBtn) { docSearchBtn.click(); return; }
 *       const pagefindBtn = document.querySelector('site-search button[data-open-modal]');
 *       pagefindBtn?.click();
 *   });
 */

function setupDOM(html) {
  const dom = new JSDOM(html, { url: 'http://localhost' });
  return dom;
}

function attachMobileSearchHandler(dom) {
  const { document } = dom.window;
  document.querySelector('.mobile-search-btn')?.addEventListener('click', () => {
    const docSearchBtn = document.querySelector('.DocSearch-Button');
    if (docSearchBtn) {
      docSearchBtn.click();
      return;
    }
    const pagefindBtn = document.querySelector('site-search button[data-open-modal]');
    pagefindBtn?.click();
  });
}

describe('Mobile search button click handler', () => {
  let dom;

  afterEach(() => {
    dom?.window.close();
  });

  it('should click .DocSearch-Button when Algolia DocSearch is present', () => {
    dom = setupDOM(`
      <button class="mobile-search-btn">Search</button>
      <button class="DocSearch-Button">Algolia</button>
      <site-search><button data-open-modal>Pagefind</button></site-search>
    `);
    attachMobileSearchHandler(dom);

    const docSearchBtn = dom.window.document.querySelector('.DocSearch-Button');
    const pagefindBtn = dom.window.document.querySelector('site-search button[data-open-modal]');

    const docSearchSpy = vi.fn();
    const pagefindSpy = vi.fn();
    docSearchBtn.addEventListener('click', docSearchSpy);
    pagefindBtn.addEventListener('click', pagefindSpy);

    dom.window.document.querySelector('.mobile-search-btn').click();

    expect(docSearchSpy).toHaveBeenCalledOnce();
    expect(pagefindSpy).not.toHaveBeenCalled();
  });

  it('should fall back to pagefind button when DocSearch is absent', () => {
    dom = setupDOM(`
      <button class="mobile-search-btn">Search</button>
      <site-search><button data-open-modal>Pagefind</button></site-search>
    `);
    attachMobileSearchHandler(dom);

    const pagefindBtn = dom.window.document.querySelector('site-search button[data-open-modal]');
    const pagefindSpy = vi.fn();
    pagefindBtn.addEventListener('click', pagefindSpy);

    dom.window.document.querySelector('.mobile-search-btn').click();

    expect(pagefindSpy).toHaveBeenCalledOnce();
  });

  it('should not throw when neither search provider button exists', () => {
    dom = setupDOM(`<button class="mobile-search-btn">Search</button>`);
    attachMobileSearchHandler(dom);

    expect(() => {
      dom.window.document.querySelector('.mobile-search-btn').click();
    }).not.toThrow();
  });

  it('should not throw when mobile-search-btn is missing entirely', () => {
    dom = setupDOM(`<div>no search button</div>`);
    expect(() => attachMobileSearchHandler(dom)).not.toThrow();
  });

  it('should prefer DocSearch over pagefind when both are present', () => {
    dom = setupDOM(`
      <button class="mobile-search-btn">Search</button>
      <button class="DocSearch-Button">Algolia</button>
      <site-search><button data-open-modal>Pagefind</button></site-search>
    `);
    attachMobileSearchHandler(dom);

    const docSearchBtn = dom.window.document.querySelector('.DocSearch-Button');
    const pagefindBtn = dom.window.document.querySelector('site-search button[data-open-modal]');

    const docSearchSpy = vi.fn();
    const pagefindSpy = vi.fn();
    docSearchBtn.addEventListener('click', docSearchSpy);
    pagefindBtn.addEventListener('click', pagefindSpy);

    dom.window.document.querySelector('.mobile-search-btn').click();

    expect(docSearchSpy).toHaveBeenCalledTimes(1);
    expect(pagefindSpy).toHaveBeenCalledTimes(0);
  });

  it('should fire DocSearch on every click (not just first)', () => {
    dom = setupDOM(`
      <button class="mobile-search-btn">Search</button>
      <button class="DocSearch-Button">Algolia</button>
    `);
    attachMobileSearchHandler(dom);

    const docSearchBtn = dom.window.document.querySelector('.DocSearch-Button');
    const spy = vi.fn();
    docSearchBtn.addEventListener('click', spy);

    const btn = dom.window.document.querySelector('.mobile-search-btn');
    btn.click();
    btn.click();
    btn.click();

    expect(spy).toHaveBeenCalledTimes(3);
  });
});
