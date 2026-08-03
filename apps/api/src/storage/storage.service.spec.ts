import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(
    async (_client: unknown, command: any) =>
      `assinada://${command.input.Bucket}/${command.input.Key}`,
  ),
}));

const ENDPOINT = 'https://t3.storage.dev';

function makeConfigMock(vars: Record<string, string>) {
  return {
    get: (chave: string, padrao?: string) => vars[chave] ?? padrao,
  };
}

/**
 * Sobe o serviço com o S3 trocado por um espião.
 *
 * `onModuleInit` é chamado à mão porque é ele que lê a configuração — o Nest
 * faria isso no boot, e sem ele os dois buckets ficam `undefined`.
 */
function makeService(vars: Record<string, string>) {
  const service = new StorageService(makeConfigMock(vars) as any);
  service.onModuleInit();

  const send = jest.fn();
  (service as any).s3 = { send };

  return { service, send };
}

/** O `Bucket` que foi parar no último comando mandado ao S3. */
function bucketDoUltimoComando(send: jest.Mock): string {
  return send.mock.calls.at(-1)![0].input.Bucket;
}

const DOIS_BUCKETS = {
  S3_ENDPOINT: ENDPOINT,
  S3_BUCKET: 'nomads-uploads',
  S3_BUCKET_PUBLIC: 'nomads-public',
  S3_BUCKET_PRIVATE: 'nomads-uploads',
};

describe('StorageService', () => {
  describe('separação entre o bucket público e o privado', () => {
    it('sobe arquivo público no bucket público e devolve a URL crua', async () => {
      const { service, send } = makeService(DOIS_BUCKETS);

      const url = await service.uploadPublic(
        'room-posts/sala/usuario/post.jpg',
        Buffer.from('x'),
        'image/jpeg',
      );

      expect(bucketDoUltimoComando(send)).toBe('nomads-public');
      // A URL é o que vai para o `<Image>` do app. Se ela nomear o bucket
      // privado, a foto dá 403 mesmo com o arquivo no lugar certo.
      expect(url).toBe(`${ENDPOINT}/nomads-public/room-posts/sala/usuario/post.jpg`);
    });

    it('sobe arquivo privado no bucket privado e devolve URL assinada', async () => {
      const { service, send } = makeService(DOIS_BUCKETS);

      const url = await service.uploadPrivate(
        'proof-photos/prova.jpg',
        Buffer.from('x'),
        'image/jpeg',
      );

      expect(bucketDoUltimoComando(send)).toBe('nomads-uploads');
      expect(url).toBe('assinada://nomads-uploads/proof-photos/prova.jpg');
    });

    it('assina sempre contra o bucket privado', async () => {
      const { service } = makeService(DOIS_BUCKETS);

      // No público a URL crua já serve; assinar ali só criaria um link que
      // expira sem necessidade.
      await expect(service.getSignedUrl('documents/a/b.pdf')).resolves.toBe(
        'assinada://nomads-uploads/documents/a/b.pdf',
      );
    });
  });

  /**
   * `deleteObject` recebe só a chave — o chamador não sabe que existem dois
   * buckets. Errar aqui não levanta erro nenhum: o objeto simplesmente fica
   * órfão para sempre no bucket que ninguém apaga.
   */
  describe('deleteObject — o bucket sai do prefixo da chave', () => {
    it.each([
      ['avatars/usuario/avatar.png', 'nomads-public'],
      ['room-posts/sala/usuario/post.jpg', 'nomads-public'],
      ['audio-clips/hash.mp3', 'nomads-public'],
      ['documents/usuario/uuid-arquivo.pdf', 'nomads-uploads'],
      ['lessons/usuario/uuid-aula.m4a', 'nomads-uploads'],
      ['proof-photos/usuario/prova.jpg', 'nomads-uploads'],
    ])('%s → %s', async (chave, bucketEsperado) => {
      const { service, send } = makeService(DOIS_BUCKETS);

      await service.deleteObject(chave);

      expect(bucketDoUltimoComando(send)).toBe(bucketEsperado);
    });

    it('a barra faz parte do prefixo — "avatars-antigos/" não é "avatars/"', async () => {
      const { service, send } = makeService(DOIS_BUCKETS);

      await service.deleteObject('avatars-antigos/usuario.png');

      // Privado é o lado seguro do erro: apagar no bucket errado deixa lixo,
      // mas tratar chave desconhecida como pública convidaria a gravar coisa
      // privada num lugar que qualquer um lê.
      expect(bucketDoUltimoComando(send)).toBe('nomads-uploads');
    });
  });

  /**
   * O caminho de volta: da URL guardada no banco para a chave do objeto.
   * Sem ele, apagar a conta deixa o avatar legível por qualquer um no bucket
   * público — para sempre, porque ninguém mais sabe o endereço dele.
   */
  describe('chaveDaUrl', () => {
    it('extrai a chave de uma URL do bucket público', () => {
      const { service } = makeService(DOIS_BUCKETS);

      expect(
        service.chaveDaUrl(`${ENDPOINT}/nomads-public/avatars/usuario/avatar.png`),
      ).toBe('avatars/usuario/avatar.png');
    });

    it('reconhece também o bucket privado — objeto de antes da separação', () => {
      const { service } = makeService(DOIS_BUCKETS);

      expect(
        service.chaveDaUrl(`${ENDPOINT}/nomads-uploads/avatars/usuario/avatar.png`),
      ).toBe('avatars/usuario/avatar.png');
    });

    it.each([
      ['URL de terceiro (foto do login social)', 'https://lh3.googleusercontent.com/a/foto'],
      ['bucket que não é nosso', `${ENDPOINT}/bucket-alheio/avatars/usuario/avatar.png`],
      ['outro endpoint', 'https://s3.amazonaws.com/nomads-public/avatars/usuario/avatar.png'],
      ['a raiz do bucket, sem chave', `${ENDPOINT}/nomads-public/`],
    ])('devolve null para %s', (_caso, url) => {
      const { service } = makeService(DOIS_BUCKETS);

      expect(service.chaveDaUrl(url)).toBeNull();
    });
  });

  /**
   * A ordem do deploy não pode quebrar nada: o código novo sobe antes de
   * alguém setar as variáveis novas no Railway, e nesse intervalo ele tem que
   * se comportar exatamente como o de um bucket só.
   */
  describe('compatibilidade — deploy que ainda não recebeu as variáveis novas', () => {
    const SO_S3_BUCKET = { S3_ENDPOINT: ENDPOINT, S3_BUCKET: 'nomads-uploads' };

    it('cai em S3_BUCKET para os dois lados', async () => {
      const { service, send } = makeService(SO_S3_BUCKET);

      const url = await service.uploadPublic(
        'avatars/usuario/avatar.png',
        Buffer.from('x'),
        'image/png',
      );
      expect(bucketDoUltimoComando(send)).toBe('nomads-uploads');
      expect(url).toBe(`${ENDPOINT}/nomads-uploads/avatars/usuario/avatar.png`);

      await service.uploadPrivate('documents/a.pdf', Buffer.from('x'), 'application/pdf');
      expect(bucketDoUltimoComando(send)).toBe('nomads-uploads');

      await service.deleteObject('avatars/usuario/avatar.png');
      expect(bucketDoUltimoComando(send)).toBe('nomads-uploads');
    });
  });
});
