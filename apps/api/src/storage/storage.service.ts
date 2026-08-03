import { Injectable, OnModuleInit } from '@nestjs/common';
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
  private s3: S3Client;
  private endpoint: string;
  /** Leitura anônima liberada. Avatar, foto de post e clipe de áudio. */
  private bucketPublico: string;
  /** Sem leitura anônima. Prova de sessão, documento e aula — só por URL assinada. */
  private bucketPrivado: string;

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

    return `${this.endpoint}/${this.bucketPublico}/${filePath}`;
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
    for (const bucket of new Set([this.bucketPublico, this.bucketPrivado])) {
      const prefixo = `${this.endpoint}/${bucket}/`;
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
