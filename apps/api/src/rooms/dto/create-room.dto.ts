import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  display_name: string;

  /**
   * Como a sala funciona, escolhido **na criação dela**.
   *
   * Isto morava só no `POST /rooms/:id/challenges`, e a consequência era uma
   * sala que nascia inerte: sem desafio, `isStudyChallenge` é falso, então nem
   * o botão do timer nem a faixa de "estudando agora" apareciam, e nada na tela
   * dizia que faltava um segundo passo. Quem criava a sala recebia um GymRats
   * sem a única coisa que é nossa.
   *
   * Continua opcional porque a rota é pública e há build em campo (1.2.1) que
   * manda só `name` e `display_name`. Sem estes dois campos o comportamento é
   * exatamente o de antes — sala sem desafio —, então nada quebra por ordem de
   * deploy.
   */
  @IsIn(['photo', 'study'])
  @IsOptional()
  participation_mode?: 'photo' | 'study';

  /**
   * Duração do primeiro desafio, em dias. O teto de 365 é o mesmo espírito do
   * `MaxLength` do nome: recusar o absurdo sem opinar sobre o razoável.
   */
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  duration_days?: number;

  /**
   * Quanta gente cabe. O dono escolhe na criação e pode mudar depois — ver
   * `UpdateRoomDto`, que carrega a regra de não encolher abaixo de quem já
   * está dentro.
   *
   * Opcional pelo mesmo motivo dos campos acima: há build em campo que não
   * manda, e sem ele a sala nasce com o padrão de sempre.
   */
  @IsInt()
  @Min(2)
  @Max(100)
  @IsOptional()
  max_members?: number;
}
