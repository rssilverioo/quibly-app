import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const storage = semComentarios(ler('../services/storage.ts'));
const perfil = semComentarios(ler('../app/(tabs)/profile.tsx'));

/**
 * Trocar a foto de perfil respondia "Failed to upload avatar" com a foto já
 * no armazenamento.
 *
 * O upload nunca foi o problema: `POST /users/me/avatar` sobe o arquivo,
 * grava `avatarUrl` e devolve o perfil inteiro. A tela então emendava um
 * `PATCH /users/me` com `avatar_url` para gravar de novo — e a API roda com
 * `forbidNonWhitelisted`, com um DTO que aceita só `username`, `bio` e
 * `handle`. O passo a mais dava 400.
 */
describe('a foto de perfil', () => {
  it('grava numa chamada só — o upload já persiste', () => {
    expect(perfil).not.toContain("updateProfile({ avatar_url");
    expect(perfil).toContain('setProfile(await uploadAvatar(');
  });

  it('o upload devolve o perfil, não uma URL solta', () => {
    // Devolver a URL era o que obrigava quem chamava a gravar de novo.
    expect(storage).toContain("api.upload<Profile>('/users/me/avatar'");
  });

  /**
   * O `catch` era vazio — sem sequer ligar a variável. Um 400 de validação,
   * um 413 de arquivo grande e uma queda de rede viravam a mesma frase, e não
   * havia como saber qual tinha sido. Foi o que fez o defeito durar.
   */
  it('mostra a causa que o servidor deu, quando há', () => {
    expect(perfil).not.toMatch(/catch\s*\{\s*Alert\.alert/);
    expect(perfil).toContain('(err as Error)?.message');
  });
});
