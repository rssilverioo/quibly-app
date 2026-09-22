/**
 * Os dois botões de loja, com os logos.
 *
 * O Lucide não tem marca registrada — Apple e Google Play saíram dele de
 * propósito — então os dois logos são `path` inline: a maçã no traço
 * oficial simplificado e o triângulo do Play em quatro faces. Nada de
 * imagem externa: os botões aparecem no herói, e uma requisição a mais ali
 * é um quadro a mais de botão vazio.
 *
 * O da App Store é preto e o do Play é branco com borda, como as próprias
 * lojas pedem nos guias de "badge". Não são os badges oficiais (que exigem
 * a arte deles sem alteração); são botões do site, com o logo como ícone.
 */
export const APP_STORE = 'https://apps.apple.com/us/app/quibly-study-together/id6760320166';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.quibly.app';

function LogoApple() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 12.77c-.026-2.59 2.115-3.83 2.21-3.89-1.206-1.76-3.08-2.002-3.744-2.03-1.594-.162-3.11.94-3.918.94-.807 0-2.055-.917-3.378-.892-1.737.026-3.338 1.01-4.232 2.567-1.806 3.13-.462 7.76 1.297 10.3.86 1.243 1.884 2.64 3.227 2.59 1.296-.05 1.785-.84 3.352-.84 1.566 0 2.006.84 3.378.814 1.395-.026 2.278-1.267 3.13-2.516.985-1.443 1.392-2.842 1.416-2.914-.03-.013-2.717-1.043-2.738-4.13zM13.79 5.17c.714-.866 1.196-2.07 1.064-3.27-1.03.042-2.276.686-3.014 1.55-.662.766-1.242 1.99-1.086 3.166 1.148.089 2.32-.583 3.036-1.446z" />
    </svg>
  );
}

function LogoPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00D7FE" d="M3.6 2.3 13.9 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z" />
      <path fill="#00F076" d="m3.6 2.3 12.2 6.9-2.9 2.8L3.6 2.3z" />
      <path fill="#FF3A44" d="m13.9 12 2.9-2.8 4.2 2.4c.9.5.9 1.3 0 1.8l-4.2 2.4-2.9-2.8-.1-1z" />
      <path fill="#FFD400" d="m13.9 12 2.9 2.8-12.2 6.9L13.9 12z" />
    </svg>
  );
}

export default function BotoesDeLoja({
  apple,
  google,
  centro,
}: {
  apple: string;
  google: string;
  centro?: boolean;
}) {
  return (
    <div className={centro ? 'lojas lojas-centro' : 'lojas'}>
      <a className="btn btn-loja btn-loja-apple" href={APP_STORE}>
        <LogoApple />
        <span>{apple}</span>
      </a>
      <a className="btn btn-loja btn-loja-google" href={PLAY_STORE}>
        <LogoPlay />
        <span>{google}</span>
      </a>
    </div>
  );
}
