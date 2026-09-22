/**
 * As URLs das duas lojas, num módulo sem `'use client'`.
 *
 * `BotoesDeLoja` é componente de cliente (tem `onClick` para o pixel), e
 * tudo que um módulo de cliente exporta vira **referência de cliente** quando
 * um componente de servidor importa. As constantes exportadas de lá
 * chegavam ao `redirect()` do `/download` como função proxy, e o iPhone era
 * mandado para `quibly.com.br/function(){throw Error(...)}`. Por isso as
 * URLs moram aqui, num módulo comum, e os dois lados importam daqui.
 */
export const APP_STORE = 'https://apps.apple.com/us/app/quibly-study-together/id6760320166';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.quibly.app';
