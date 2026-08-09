import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

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
      service: new FeedService(prisma as never, {} as never, {} as never, {} as never),
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

/**
 * Anexar foto ao post da sessão.
 *
 * O check-in nasce com foto; o post de sessão não — quem termina um pomodoro
 * publica só minutos e XP, e número não conta o que a pessoa estava fazendo.
 */
describe('FeedService.attachPhoto', () => {
  const foto = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' } as never;

  function servico(post: unknown) {
    const prisma = {
      feedPost: {
        findUnique: jest.fn().mockResolvedValue(post),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const storage = { uploadPublic: jest.fn().mockResolvedValue('https://cdn/f.jpg') };
    return {
      service: new FeedService(prisma as never, {} as never, {} as never, storage as never),
      prisma,
      storage,
    };
  }

  it('a foto vale para todas as cópias da sessão, e sobe uma vez só', async () => {
    // Uma sessão publica em todas as salas de que a pessoa participa. Anexar a
    // uma cópia só criaria a mesma sessão com foto numa sala e sem foto na
    // outra — um estado que nenhuma tela sabe explicar.
    const { service, prisma, storage } = servico({ id: 'p1', userId: 'eu', sessionId: 's1' });

    await expect(service.attachPhoto('eu', 'p1', foto)).resolves.toEqual({
      photo_url: 'https://cdn/f.jpg',
    });

    expect(storage.uploadPublic).toHaveBeenCalledTimes(1);
    expect(prisma.feedPost.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 's1', userId: 'eu' },
      data: { photoUrl: 'https://cdn/f.jpg', showProofPhoto: true },
    });
  });

  it('a chave sai da sessão, para reenviar sobrescrever em vez de deixar órfão', async () => {
    const { service, storage } = servico({ id: 'p1', userId: 'eu', sessionId: 's1' });
    await service.attachPhoto('eu', 'p1', foto);
    expect(storage.uploadPublic.mock.calls[0][0]).toBe('session-posts/eu/s1');
  });

  it('post sem sessão — o check-in — atualiza só a si mesmo', async () => {
    // Ali não há irmãos, e varrer por `sessionId: null` pegaria todos os
    // check-ins avulsos da pessoa.
    const { service, prisma } = servico({ id: 'p1', userId: 'eu', sessionId: null });
    await service.attachPhoto('eu', 'p1', foto);
    expect(prisma.feedPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ showProofPhoto: true }),
    });
  });

  it('recusa foto em post de outra pessoa, e recusa arquivo que não é imagem', async () => {
    const { service } = servico({ id: 'p1', userId: 'outra', sessionId: 's1' });
    await expect(service.attachPhoto('eu', 'p1', foto)).rejects.toThrow(ForbiddenException);

    const meu = servico({ id: 'p1', userId: 'eu', sessionId: 's1' });
    await expect(
      meu.service.attachPhoto('eu', 'p1', { buffer: Buffer.from('x'), mimetype: 'application/pdf' } as never),
    ).rejects.toThrow(BadRequestException);
  });
});
