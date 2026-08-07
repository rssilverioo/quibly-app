import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * O que o dono da sala pode mudar depois de criá-la.
 *
 * **A data não está aqui, e é decisão de produto.** Ela define a janela do
 * desafio: mexer nela depois de as pessoas terem estudado mudaria o resultado
 * de uma disputa em andamento — dias já contados sairiam da conta, ou dias
 * futuros entrariam. Quem precisa de outra data cria outra sala; é mais
 * trabalho e é honesto com quem já entrou.
 *
 * A capa também não vem por aqui: é upload de arquivo, em rota própria.
 */
export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
