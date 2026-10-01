import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ETHICAL_ADS_PUBLISHER,
  FLOATING_AD_PLACEMENTS,
  FLOATING_AD_WIDE_QUERY,
  MAX_AD_KEYWORDS,
  adKeywords,
  ethicalAdsPublisher,
  pageAdKeywords,
  resolveEthicalAdsPublisher,
} from '../../src/lib/ethical-ads.mjs';

describe('ethicalAdsPublisher', () => {
  it('accepts and trims valid ids', () => {
    expect(ethicalAdsPublisher(' qainsightscom ')).toBe('qainsightscom');
    expect(ethicalAdsPublisher('my-site_2')).toBe('my-site_2');
  });

  it('rejects empty or unsafe ids', () => {
    expect(ethicalAdsPublisher('')).toBeNull();
    expect(ethicalAdsPublisher(undefined)).toBeNull();
    expect(ethicalAdsPublisher('bad id')).toBeNull();
    expect(ethicalAdsPublisher('"><script>')).toBeNull();
  });
});

describe('resolveEthicalAdsPublisher', () => {
  it('defaults to the site publisher when unset', () => {
    expect(resolveEthicalAdsPublisher(undefined)).toBe(DEFAULT_ETHICAL_ADS_PUBLISHER);
  });

  it('disables ads for "off" or an empty value', () => {
    expect(resolveEthicalAdsPublisher('off')).toBeNull();
    expect(resolveEthicalAdsPublisher(' OFF ')).toBeNull();
    expect(resolveEthicalAdsPublisher('')).toBeNull();
  });

  it('uses a valid override', () => {
    expect(resolveEthicalAdsPublisher('otherpub')).toBe('otherpub');
  });
});

describe('adKeywords', () => {
  it('slugifies, dedupes and pipe-joins', () => {
    expect(adKeywords(['JMeter', 'Thread Group', 'jmeter', null, undefined, '  '])).toBe(
      'jmeter|thread-group',
    );
  });

  it(`caps at ${MAX_AD_KEYWORDS} keywords`, () => {
    const many = Array.from({ length: 20 }, (_, i) => `k${i}`);
    expect(adKeywords(many).split('|')).toHaveLength(MAX_AD_KEYWORDS);
  });
});

describe('pageAdKeywords', () => {
  it('adds the site section and frontmatter keywords to the baseline', () => {
    expect(pageAdKeywords('/components/http-request/', ['HTTP Sampler'])).toBe(
      'jmeter|apache-jmeter|performance-testing|load-testing|components|http-sampler',
    );
  });

  it('uses only the baseline on the homepage', () => {
    expect(pageAdKeywords('/')).toBe('jmeter|apache-jmeter|performance-testing|load-testing');
  });
});

describe('FLOATING_AD_PLACEMENTS', () => {
  it('uses a corner image ad on wide screens and a text footer otherwise', () => {
    expect(FLOATING_AD_WIDE_QUERY).toBe('(min-width: 1301px)');
    expect(FLOATING_AD_PLACEMENTS.wide).toEqual({ id: 'float-stickybox', type: 'image', style: 'stickybox' });
    expect(FLOATING_AD_PLACEMENTS.narrow).toEqual({ id: 'float-footer', type: 'text', style: 'fixedfooter' });
  });
});
