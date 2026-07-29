/**
 * Resolver o país do usuário a partir do que o aparelho e a rede dizem.
 *
 * ## A regra que decide os conflitos: o locale manda
 *
 * Quando o locale do aparelho e o IP discordam, ganha o **locale**. Isso não é
 * arbitrário — é a leitura correta de quem são essas pessoas.
 *
 * Um brasileiro que se mudou para Portugal continua estudando para o ENEM. Um
 * estudante em intercâmbio nos EUA continua fazendo OAB. O IP diz onde o corpo
 * está; o locale diz para qual sistema educacional a cabeça está virada, e é
 * esse que importa num app de preparação para prova.
 *
 * O IP entra como desempate quando o locale não carrega região (`pt` em vez de
 * `pt-BR`), que é o caso comum em Android.
 *
 * Nada disto é imposição: a sugestão sempre pode ser trocada no onboarding.
 */

/** Países que o produto atende hoje. Cresce junto com `prisma/seeds`. */
export const SUPPORTED_COUNTRIES = ['BR', 'US'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const FALLBACK_COUNTRY: SupportedCountry = 'BR';

/**
 * Quando o locale só tem idioma, sem região. `pt` sozinho é quase sempre
 * Brasil no nosso público — Portugal viraria uma entrada própria no dia em que
 * existir um seed `PT`, e aí a ambiguidade passa a ser resolvida pelo IP.
 */
const LANGUAGE_TO_COUNTRY: Record<string, SupportedCountry> = {
  pt: 'BR',
  en: 'US',
};

export interface CountryResolutionInput {
  /** BCP 47 do aparelho, ex: 'pt-BR', 'en-US', 'pt'. */
  locale?: string | null;
  /** ISO alpha-2 derivado do IP pela borda, ex: 'BR'. */
  ipCountry?: string | null;
}

export interface CountryResolution {
  country: SupportedCountry;
  /**
   * Como chegamos nela. Vale registrar: se `fallback` for comum em produção,
   * é sinal de que falta um país no catálogo — e é assim que descobrimos qual
   * mercado abrir em seguida, sem adivinhar.
   */
  source: 'locale-region' | 'ip' | 'locale-language' | 'fallback';
}

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSupported(code: string): code is SupportedCountry {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(code);
}

/** A região de um BCP 47: 'pt-BR' → 'BR'. Null se o locale não tiver região. */
export function regionFromLocale(locale: string | null | undefined): string | null {
  const value = normalize(locale);
  if (!value) return null;
  // Aceita '-' e '_', porque Android manda 'pt_BR' em algumas rotas.
  const parts = value.replace(/_/g, '-').split('-');
  if (parts.length < 2) return null;
  // A região é o segmento de 2 letras; ignora script ('zh-Hant-TW').
  const region = parts.find((part, i) => i > 0 && /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
}

export function languageFromLocale(locale: string | null | undefined): string | null {
  const value = normalize(locale);
  if (!value) return null;
  const lang = value.replace(/_/g, '-').split('-')[0];
  return /^[A-Za-z]{2,3}$/.test(lang) ? lang.toLowerCase() : null;
}

export function resolveCountry(input: CountryResolutionInput): CountryResolution {
  // 1. Locale com região é o sinal mais forte que existe: a pessoa configurou
  //    o aparelho, deliberadamente, para aquele país.
  const localeRegion = regionFromLocale(input.locale);
  if (localeRegion && isSupported(localeRegion)) {
    return { country: localeRegion, source: 'locale-region' };
  }

  // 2. Sem região no locale, o IP é o próximo melhor palpite — é onde a pessoa
  //    de fato está.
  const ip = normalize(input.ipCountry)?.toUpperCase();
  if (ip && isSupported(ip)) {
    return { country: ip, source: 'ip' };
  }

  // 3. Só o idioma. Mais fraco, mas ainda melhor que o default cego.
  const language = languageFromLocale(input.locale);
  if (language && LANGUAGE_TO_COUNTRY[language]) {
    return { country: LANGUAGE_TO_COUNTRY[language], source: 'locale-language' };
  }

  return { country: FALLBACK_COUNTRY, source: 'fallback' };
}
