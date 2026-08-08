import { IsIn, IsOptional } from 'class-validator';

export class SetVerifiedDto {
  /**
   * `BLUE` — identidade conferida. `GOLD` — professor. `null` remove o selo.
   *
   * Um campo só, e não um booleano com o tipo ao lado: "verificado sem tipo" e
   * "tipo sem verificação" seriam dois estados inválidos que nada impediria.
   */
  @IsOptional()
  @IsIn(['BLUE', 'GOLD', null])
  verification!: 'BLUE' | 'GOLD' | null;
}
