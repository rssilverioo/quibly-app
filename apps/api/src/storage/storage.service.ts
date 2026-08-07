import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Os prefixos que o app serve direto ao `<Image>`, sem assinatura.
 *
 * Esta lista é a definição de "público" e existe num lugar só porque o upload e
 * o delete precisam concordar: se um grava no bucket público e o outro apaga no
 * privado, o objeto fica órfão para sempre e ninguém percebe.
 */
const PREFIXOS_PUBLICOS = ['avatars/', 'room-posts/', 'audio-clips/'] as const;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private endpoint: string;
  /** Leitura anônima liberada. Avatar, foto de post e clipe de áudio. */
  private bucketPublico: string;
  /** Sem leitura anônima. Prova de sessão, documento e aula — só por URL assinada. */
  private bucketPrivado: string;
  /**
   * De onde o app baixa um arquivo público. **Não é o endpoint do S3.**
   *
   * No Tigris, o bucket público é servido por um domínio próprio
   * (`cdn.tryquibly.com`), e o endpoint da API — `t3.storage.dev` — responde
   * **403 mesmo para objeto público**. Medido em 06/08/2026 com um objeto real:
   * 200 pelo domínio, 403 pelo endpoint, o mesmo arquivo.
   *
   * Era esse o defeito de "a foto não aparece no feed": o bucket sempre esteve
   * público e a URL sempre apontou para o host errado. Ninguém achou porque o
   * sintoma — 403 — é idêntico ao de um bucket privado, e a investigação parou
   * na primeira explicação que servia.
   */
  private baseUrlPublica: string;

  constructor(private readonly configService: ConfigService) {}

  /**
   * **Por que dois buckets, e não um com política por prefixo.**
   *
   * O plano original era um bucket só com uma bucket policy liberando leitura
   * anônima apenas em `avatars/`, `room-posts/` e `audio-clips/`. O Tigris não
   * permite: `PutBucketPolicy` responde `NotImplemented`, e o `ACL:
   * 'public-read'` por objeto que o `uploadPublic` sempre mandou **é ignorado**
   * — testado em 03/08/2026 com um objeto real, que continuou dando 403 para
   * quem não estava autenticado. Lá o acesso é do bucket inteiro, ou nada.
   *
   * Com um bucket só, tornar a foto do post visível tornaria visível também
   * `proof-photos/` — e a foto de prova é privada por decisão de produto: o
   * usuário escolhe, via `showProofPhoto`, se ela aparece no feed. Um bucket
   * público desfaz essa escolha para todo mundo de uma vez.
   *
   * Daí a separação física. `S3_BUCKET` continua sendo lido como reserva para
   * que um deploy que ainda não recebeu as variáveis novas siga funcionando
   * exatamente como antes — nada quebra por ordem de deploy.
   */
  onModuleInit() {
    const reserva = this.configService.get<string>('S3_BUCKET', 'quibly-uploads');
    this.bucketPublico = this.configService.get<string>('S3_BUCKET_PUBLIC', reserva);
    this.bucketPrivado = this.configService.get<string>('S3_BUCKET_PRIVATE', reserva);
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', 'https://t3.storage.dev');

    /**
     * Sem `S3_PUBLIC_BASE_URL` o comportamento é exatamente o de antes: um
     * deploy que não recebeu a variável monta a URL como sempre montou.
     *
     * As aspas em volta são retiradas porque painéis de ambiente as adicionam:
     * o mesmo editor que entregou o JSON do Firebase escapado entrega
     * `"https://cdn.tryquibly.com"` aqui. O valor está certo, só chegou vestido.
     */
    const baseConfigurada = this.configService
      .get<string>('S3_PUBLIC_BASE_URL', '')
      .trim()
      .replace(/^['"]|['"]$/g, '');

    const ehAbsoluta = /^https?:\/\/./.test(baseConfigurada);

    /**
     * **Um valor ruim aqui não derruba mais a API.**
     *
     * Isto já foi um `throw`, e o argumento era bom: a URL é *gravada* em
     * `profile.avatarUrl` e `feedPost.photoUrl`, então um valor sem esquema
     * produz linha quebrada no banco — permanente e silenciosa. Falhar no boot
     * parecia a única janela barata.
     *
     * O argumento estava certo e a conclusão errada. Em produção esse `throw`
     * derrubou a aplicação inteira num laço de reinício: login, feed, salas e
     * sessões fora do ar por causa de uma variável de **storage**. A cura foi
     * pior que a doença — trocou um defeito localizado por um apagão.
     *
     * Agora o valor ruim é recusado e o serviço cai no endereço antigo. As
     * fotos voltam a ter a URL errada, que é exatamente o que acontecia antes
     * desta variável existir, e o resto do produto segue de pé. O erro grita no
     * log em vez de matar o processo.
     */
    if (baseConfigurada && !ehAbsoluta) {
      this.logger.error(
        `S3_PUBLIC_BASE_URL ignorada: precisa ser uma URL absoluta (https://...) e veio "${baseConfigurada}". ` +
          'A foto pública volta a usar o endpoint do S3, que responde 403 — corrija a variável para destravá-la.',
      );
    }

    this.baseUrlPublica = (
      (ehAbsoluta ? baseConfigurada : '') || `${this.endpoint}/${this.bucketPublico}`
    ).replace(/\/+$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /**
   * Em que bucket esta chave vive.
   *
   * `deleteObject` recebe só a chave — `avatars/x` vem de `users.service`,
   * `documents/x` de `documents.service` — e precisa acertar o bucket sem que o
   * chamador saiba que existem dois.
   */
  private bucketDaChave(key: string): string {
    return PREFIXOS_PUBLICOS.some((p) => key.startsWith(p))
      ? this.bucketPublico
      : this.bucketPrivado;
  }

  /**
   * Sobe um arquivo privado e devolve URL assinada. Prova de sessão, documento,
   * aula. Nunca é servido direto — a URL expira.
   */
  async uploadPrivate(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketPrivado,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return this.getSignedUrl(filePath);
  }

  /**
   * Sobe um arquivo de leitura anônima e devolve a URL crua, que o app põe
   * direto num `<Image>`.
   *
   * O `ACL: 'public-read'` fica por correção de contrato — é o que qualquer S3
   * de verdade espera. **No Tigris ele não faz nada** (ver a nota de
   * `onModuleInit`); quem libera a leitura é a configuração do bucket. Se um
   * dia migrarmos de provedor, esta linha passa a valer sozinha.
   */
  async uploadPublic(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketPublico,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );

    return `${this.baseUrlPublica}/${filePath}`;
  }

  /**
   * A chave de dentro de uma URL que **nós** montamos, ou `null`.
   *
   * Existe porque quem guarda a URL — `profile.avatarUrl`, `feedPost.photoUrl`
   * — guarda a URL inteira, e não a chave. Para apagar o objeto é preciso o
   * caminho de volta.
   *
   * O `null` não é detalhe: `avatarUrl` também recebe URL de terceiro (foto do
   * login social), e URL de objeto que subiu antes da separação dos buckets
   * nomeia o bucket antigo. Nos dois casos a resposta certa é "esta não é
   * minha, não mexa" — por isso a comparação é contra os buckets que
   * conhecemos, e não um `split('/')` otimista.
   */
  chaveDaUrl(url: string): string | null {
    /**
     * As duas formas convivem, e isso não é transitório.
     *
     * O banco guarda a URL inteira, então tudo que subiu antes de
     * `S3_PUBLIC_BASE_URL` existir está gravado como
     * `t3.storage.dev/<bucket>/<chave>`. Se esta função só reconhecesse a forma
     * nova, apagar um avatar antigo passaria a devolver `null` — o registro
     * sumiria do banco e o objeto ficaria órfão no storage, em silêncio.
     */
    const prefixos = [
      `${this.baseUrlPublica}/`,
      ...[...new Set([this.bucketPublico, this.bucketPrivado])].map(
        (bucket) => `${this.endpoint}/${bucket}/`,
      ),
    ];

    for (const prefixo of prefixos) {
      if (url.startsWith(prefixo) && url.length > prefixo.length) {
        return url.slice(prefixo.length);
      }
    }
    return null;
  }

  /** Apaga um arquivo. O bucket sai do prefixo da chave — ver `bucketDaChave`. */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketDaChave(key),
        Key: key,
      }),
    );
  }

  /**
   * URL assinada, validade de 7 dias (o teto do SigV4).
   *
   * Só faz sentido para o bucket privado: no público a URL crua já serve, e
   * assinar ali só criaria um link que expira sem necessidade.
   */
  async getSignedUrl(filePath: string, expiresIn = 7 * 24 * 60 * 60): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketPrivado,
      Key: filePath,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }
}
