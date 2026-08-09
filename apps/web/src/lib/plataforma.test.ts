import { describe, expect, it } from 'vitest';

import { plataformaDe } from './plataforma';

/** Cabeçalhos reais, e não inventados — é neles que a detecção erra. */
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  instagramIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.0.32.98',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Instagram 334.0.0.32.98 Android',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  robo: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  whatsapp: 'WhatsApp/2.24.10.85 A',
};

describe('plataformaDe', () => {
  it('reconhece iPhone e Android', () => {
    expect(plataformaDe(UA.iphone)).toBe('ios');
    expect(plataformaDe(UA.android)).toBe('android');
  });

  it('funciona dentro do navegador do Instagram, que é o caso que importa', () => {
    // O link vai na bio, então quase todo acesso chega por esta webview.
    expect(plataformaDe(UA.instagramIphone)).toBe('ios');
    expect(plataformaDe(UA.instagramAndroid)).toBe('android');
  });

  it('não confunde Android com iOS por causa do "like Mac OS X"', () => {
    // Vários navegadores Android herdam esse trecho do WebKit. Testar iOS antes
    // de Android classificaria metade dos aparelhos errado.
    expect(
      plataformaDe(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/605.1.15 (KHTML, like Gecko, like Mac OS X)',
      ),
    ).toBe('android');
  });

  it('manda computador e robôs para a página de escolha', () => {
    // O robô **tem** que ver a página: é dela que sai o cartão do link.
    expect(plataformaDe(UA.mac)).toBe('outra');
    expect(plataformaDe(UA.robo)).toBe('outra');
    expect(plataformaDe(UA.whatsapp)).toBe('outra');
  });

  it('sem cabeçalho, cai na escolha em vez de chutar', () => {
    expect(plataformaDe(null)).toBe('outra');
    expect(plataformaDe('')).toBe('outra');
  });
});
