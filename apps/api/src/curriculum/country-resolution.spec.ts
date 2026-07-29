import {
  languageFromLocale,
  regionFromLocale,
  resolveCountry,
} from './country-resolution';

describe('regionFromLocale', () => {
  it('extracts the region', () => {
    expect(regionFromLocale('pt-BR')).toBe('BR');
    expect(regionFromLocale('en-US')).toBe('US');
  });

  it('accepts underscores — Android sends pt_BR on some paths', () => {
    expect(regionFromLocale('pt_BR')).toBe('BR');
  });

  it('uppercases a lowercase region', () => {
    expect(regionFromLocale('pt-br')).toBe('BR');
  });

  it('skips the script subtag', () => {
    expect(regionFromLocale('zh-Hant-TW')).toBe('TW');
  });

  it('is null when the locale carries no region', () => {
    expect(regionFromLocale('pt')).toBeNull();
    expect(regionFromLocale('')).toBeNull();
    expect(regionFromLocale(null)).toBeNull();
    expect(regionFromLocale(undefined)).toBeNull();
  });
});

describe('languageFromLocale', () => {
  it('extracts and lowercases the language', () => {
    expect(languageFromLocale('PT-BR')).toBe('pt');
    expect(languageFromLocale('en')).toBe('en');
  });

  it('is null for junk', () => {
    expect(languageFromLocale('123')).toBeNull();
    expect(languageFromLocale(null)).toBeNull();
  });
});

describe('resolveCountry', () => {
  it('prefers the locale region', () => {
    expect(resolveCountry({ locale: 'pt-BR', ipCountry: 'US' })).toEqual({
      country: 'BR',
      source: 'locale-region',
    });
  });

  // This is the whole reason the rule exists, so it gets its own test with its
  // own name: someone who moved abroad still studies for their home exam.
  it('lets a Brazilian in the US keep ENEM — locale beats IP', () => {
    expect(resolveCountry({ locale: 'pt-BR', ipCountry: 'US' }).country).toBe('BR');
  });

  it('lets an American in Brazil keep SAT', () => {
    expect(resolveCountry({ locale: 'en-US', ipCountry: 'BR' }).country).toBe('US');
  });

  it('falls back to IP when the locale has no region', () => {
    expect(resolveCountry({ locale: 'pt', ipCountry: 'US' })).toEqual({
      country: 'US',
      source: 'ip',
    });
  });

  it('falls back to the language when there is no region and no IP', () => {
    expect(resolveCountry({ locale: 'pt' })).toEqual({
      country: 'BR',
      source: 'locale-language',
    });
  });

  it('ignores an unsupported locale region and moves down the chain', () => {
    // 'fr-FR' isn't seeded yet; the IP still is.
    expect(resolveCountry({ locale: 'fr-FR', ipCountry: 'BR' })).toEqual({
      country: 'BR',
      source: 'ip',
    });
  });

  it('ignores an unsupported IP country too', () => {
    expect(resolveCountry({ locale: 'de', ipCountry: 'DE' })).toEqual({
      country: 'BR',
      source: 'fallback',
    });
  });

  it('falls back cleanly with no signal at all', () => {
    expect(resolveCountry({})).toEqual({ country: 'BR', source: 'fallback' });
    expect(resolveCountry({ locale: null, ipCountry: null }).country).toBe('BR');
  });

  it('reports the source, so a spike in `fallback` tells us which market to open next', () => {
    expect(resolveCountry({ locale: 'ja-JP' }).source).toBe('fallback');
  });
});
