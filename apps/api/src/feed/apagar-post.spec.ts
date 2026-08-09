import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { FeedService } from './feed.service';

/**
 * Apagar o próprio post.
 *
 * O app oferecia esse botão desde sempre e chamava uma rota que **nunca
 * existiu** — o `@Delete` do controller cobria só comentários. O servidor
 * respondia 404 e a tela dizia "não deu para apagar o post", sem nada indicar
 * que o problema não era da pessoa nem da rede.
 */
describe('FeedService.deletePost', () => {
  function servico(post: unknown) {
    const prisma = {
      feedPost: {
        findUnique: jest.fn().mockResolvedValue(post),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    return {
      service: new FeedService(prisma as never, {} as never, {} as never),
      prisma,
    };
  }

  it('apaga quando é o autor', async () => {
    const { service, prisma } = servico({ id: 'p1', userId: 'eu' });
    await expect(service.deletePost('eu', 'p1')).resolves.toEqual({ deleted: true });
    expect(prisma.feedPost.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('recusa apagar post de outra pessoa — inclusive para o dono da sala', async () => {
    // Não existe caminho de dono-da-sala aqui de propósito: para o que incomoda
    // existem denúncia e bloqueio, que não dependem de quem manda na sala.
    const { service, prisma } = servico({ id: 'p1', userId: 'outra' });
    await expect(service.deletePost('eu', 'p1')).rejects.toThrow(ForbiddenException);
    expect(prisma.feedPost.delete).not.toHaveBeenCalled();
  });

  it('post inexistente é 404, e não sucesso silencioso', async () => {
    const { service } = servico(null);
    await expect(service.deletePost('eu', 'sumiu')).rejects.toThrow(NotFoundException);
  });
});

/**
 * A ordem das rotas no controller é comportamento, não estilo.
 *
 * O Nest casa `@Delete` na ordem em que os métodos são declarados. Com
 * `:postId` **antes** de `comments/:commentId`, a palavra "comments" vira um id
 * de post — e apagar um comentário passa a responder 404 ("post não
 * encontrado") ou, pior, a apagar um post cujo id fosse "comments".
 *
 * Escrevi na ordem errada na primeira tentativa, contrariando o comentário que
 * eu mesmo tinha acabado de escrever explicando o risco. Daí o teste.
 */
describe('a rota específica vem antes da genérica', () => {
  const controller = readFileSync(join(__dirname, 'feed.controller.ts'), 'utf8');

  it('declara `comments/:commentId` antes de `:postId`', () => {
    const comentario = controller.indexOf("@Delete('comments/:commentId')");
    const post = controller.indexOf("@Delete(':postId')");
    expect(comentario).toBeGreaterThan(-1);
    expect(post).toBeGreaterThan(-1);
    expect(comentario).toBeLessThan(post);
  });
});
