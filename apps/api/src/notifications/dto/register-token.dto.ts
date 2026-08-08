import { IsString, IsOptional } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;

  /**
   * O idioma do aparelho (`pt-BR`, `en-US`), não o escolhido no app.
   *
   * A notificação chega na tela de bloqueio, entre as de todos os outros apps,
   * e ali quem manda é o idioma do celular.
   */
  @IsOptional()
  @IsString()
  locale?: string;
}
