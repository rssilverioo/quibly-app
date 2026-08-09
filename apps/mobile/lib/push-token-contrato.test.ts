import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

/**
 * O arquivo sem comentários.
 *
 * Necessário porque o comentário que **explica** o defeito cita o método
 * defeituoso pelo nome, e a primeira versão deste teste falhou contra a própria
 * documentação. Um teste que proíbe descrever o erro empurra o histórico para
 * fora do código, que é o contrário do que se quer.
 */
const codigoDe = (caminho: string) =>
  ler(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/**
 * O app e o servidor têm que falar do **mesmo tipo de token**.
 *
 * ## O defeito que este teste existe para não deixar voltar
 *
 * O app usava `Notifications.getDevicePushTokenAsync()`, que devolve o token
 * **nativo**. No Android isso é um token FCM e funcionava. No iOS é o token
 * bruto da APNs — e o servidor manda tudo por `firebase-admin`, que só aceita
 * token de registro do FCM. **Push no iPhone nunca entregou nada.**
 *
 * O que o tornou invisível: o Firebase recusa com "not a valid FCM registration
 * token", e `notifications.service.ts` reconhece essa mensagem, conclui que o
 * token morreu e **apaga a linha**. O sintoma não era erro acumulando — era a
 * tabela esvaziando. Olhando o banco, a leitura natural era "esse usuário não
 * tem token", que é a conclusão errada.
 *
 * Duas camadas, dois repositórios, e a única evidência era a ausência de
 * notificação num aparelho — que se confunde com "ninguém me mandou nada".
 */
describe('o token que o app registra é o que o servidor sabe enviar', () => {
  const app = codigoDe('./notifications.ts');
  const servidor = codigoDe('../../api/src/notifications/notifications.service.ts');

  it('o app pega o token pelo FCM, e não o nativo do aparelho', () => {
    expect(app).toContain('messaging().getToken()');
    // `getDevicePushTokenAsync` é o caminho antigo: no iOS ele devolve APNs cru.
    expect(app).not.toContain('getDevicePushTokenAsync');
  });

  it('o servidor continua enviando pelo FCM — os dois lados combinam', () => {
    // Se um dia o envio passar a falar direto com a APNs, este teste cai e
    // obriga a revisitar o app junto. É o par que importa, não cada lado.
    expect(servidor).toContain('getMessaging()');
    expect(servidor).toMatch(/\.send\(\{/);
  });

  it('o app reage à troca de token', () => {
    // O FCM troca sozinho — backup restaurado, reinstalação, limpeza de dados.
    // Sem isto a pessoa some das notificações e nada indica por quê.
    expect(app).toContain('onTokenRefresh');
    expect(codigoDe('../app/_layout.tsx')).toContain('onPushTokenRefresh');
  });

  it('a dependência que produz o token está declarada', () => {
    // Sem `@react-native-firebase/messaging` não existe caminho para um token
    // FCM — foi a ausência dela que denunciou o defeito.
    const pkg = JSON.parse(ler('../package.json'));
    expect(pkg.dependencies['@react-native-firebase/messaging']).toBeTruthy();
  });
});
