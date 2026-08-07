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
   * O host da URL pública — a causa real de "a foto não aparece no feed".
   *
   * No Tigris o bucket público é servido por um domínio próprio, e o endpoint
   * da API responde 403 **mesmo para objeto público**. Medido em 06/08/2026 com
   * um objeto real: 200 por `cdn.tryquibly.com`, 403 por `t3.storage.dev`, o
   * mesmo arquivo. O sintoma é idêntico ao de um bucket privado, e foi por isso
   * que a investigação anterior parou no bucket.
   */
  describe('S3_PUBLIC_BASE_URL — de onde o app baixa', () => {
    const COM_CDN = { ...DOIS_BUCKETS, S3_PUBLIC_BASE_URL: 'https://cdn.tryquibly.com' };

    it('monta a URL pública no domínio, e não no endpoint do S3', async () => {
      const { service, send } = makeService(COM_CDN);

      const url = await service.uploadPublic(
        'room-posts/sala/usuario/post.jpg',
        Buffer.from('x'),
        'image/jpeg',
      );

      // O arquivo continua indo para o mesmo bucket: o que muda é só o endereço
      // pelo qual o app o busca.
      expect(bucketDoUltimoComando(send)).toBe('nomads-public');
      expect(url).toBe('https://cdn.tryquibly.com/room-posts/sala/usuario/post.jpg');
    });

    it('ignora barra sobrando no fim da variável', async () => {
      const { service } = makeService({ ...COM_CDN, S3_PUBLIC_BASE_URL: 'https://cdn.tryquibly.com/' });

      const url = await service.uploadPublic('avatars/u/a.png', Buffer.from('x'), 'image/png');

      // `//avatars` daria 404 num CDN, e ninguém suspeitaria da variável.
      expect(url).toBe('https://cdn.tryquibly.com/avatars/u/a.png');
    });

    /**
     * **Valor ruim não pode derrubar a API.**
     *
     * Isto já foi um `throw`, e em produção ele pôs a aplicação inteira num laço
     * de reinício — login, feed e sessões fora do ar por uma variável de
     * storage. O valor inválido agora é ignorado e o serviço volta ao endereço
     * antigo: a foto continua com a URL errada, que é o que acontecia antes
     * desta variável existir, e o resto do produto fica de pé.
     */
    it.each([
      ['sem esquema', 'cdn.tryquibly.com'],
      ['caminho relativo', '/uploads'],
      ['só o esquema', 'https://'],
    ])('ignora S3_PUBLIC_BASE_URL %s sem derrubar o serviço', async (_caso, valor) => {
      const { service, send } = makeService({ ...DOIS_BUCKETS, S3_PUBLIC_BASE_URL: valor });

      const url = await service.uploadPublic('avatars/u/a.png', Buffer.from('x'), 'image/png');

      // Cai no endereço antigo em vez de explodir.
      expect(url).toBe(`${ENDPOINT}/nomads-public/avatars/u/a.png`);
      expect(bucketDoUltimoComando(send)).toBe('nomads-public');
    });

    /**
     * O mesmo editor de ambiente que entregou o JSON do Firebase escapado
     * entrega esta variável entre aspas. O valor está certo, só chegou vestido —
     * e recusá-lo por causa da roupa custaria a foto do feed.
     */
    it.each([
      ['aspas duplas', '"https://cdn.tryquibly.com"'],
      ['aspas simples', "'https://cdn.tryquibly.com'"],
    ])('aceita a base embrulhada em %s', async (_caso, valor) => {
      const { service } = makeService({ ...DOIS_BUCKETS, S3_PUBLIC_BASE_URL: valor });

      const url = await service.uploadPublic('avatars/u/a.png', Buffer.from('x'), 'image/png');

      expect(url).toBe('https://cdn.tryquibly.com/avatars/u/a.png');
    });

    it('não estorva quem não setou a variável', () => {
      expect(() => makeService({ ...DOIS_BUCKETS, S3_PUBLIC_BASE_URL: '  ' })).not.toThrow();
    });

    it('ainda reconhece a URL antiga, gravada antes do domínio existir', () => {
      const { service } = makeService(COM_CDN);

      // O banco guarda a URL inteira. Se esta forma deixasse de ser reconhecida,
      // apagar um avatar antigo devolveria `null` e o objeto ficaria órfão.
      expect(
        service.chaveDaUrl(`${ENDPOINT}/nomads-public/avatars/usuario/avatar.png`),
      ).toBe('avatars/usuario/avatar.png');

      expect(
        service.chaveDaUrl('https://cdn.tryquibly.com/avatars/usuario/avatar.png'),
      ).toBe('avatars/usuario/avatar.png');
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
