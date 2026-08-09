import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  /**
   * Quanta gente cabe.
   *
   * O mínimo é 2 porque uma sala de uma pessoa não é uma sala — o produto
   * inteiro se apoia em alguém do outro lado vendo você aparecer.
   *
   * O teto é 100, e é igual para todo mundo. Ele **não** é alavanca de plano:
   * uma sala capada não pune o dono, pune quem foi convidado e lê "sala cheia"
   * na porta. O que o Pro dá é sala ilimitada em quantidade, que é um custo de
   * quem paga — ver `entitlements.constants`.
   *
   * Acima de 100 o feed e o ranking deixam de ser legíveis: ninguém reconhece
   * mais quem apareceu, e reconhecer é a mecânica.
   */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  max_members?: number;
}
