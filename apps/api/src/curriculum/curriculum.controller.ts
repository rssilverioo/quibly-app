import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { SetTrackDto } from './dto/set-track.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthedUser = { userId: string; email: string };

/**
 * Leitura do currículo e escolha de track.
 *
 * As rotas de leitura são públicas de propósito: a lista de países e de provas
 * é catálogo, não dado de usuário, e o onboarding precisa dela **antes** de o
 * login existir em alguns fluxos. Só a escrita exige autenticação.
 */
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('countries')
  getCountries() {
    return this.curriculum.getCountries();
  }

  @Get('tracks')
  getTracks(@Query('country') country: string) {
    return this.curriculum.getTracks(country ?? 'BR');
  }

  @Get('tracks/:id/disciplines')
  getDisciplines(@Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.getDisciplines(id);
  }

  @Get('topics')
  getTopics(@Query('disciplineId', ParseUUIDPipe) disciplineId: string) {
    return this.curriculum.getTopics(disciplineId);
  }

  /**
   * A sugestão do onboarding. `locale` vem do aparelho; `ipCountry` da borda.
   * Em conflito o locale vence — quem mora fora estuda para a prova de casa.
   */
  @Get('suggest')
  suggest(
    @Query('locale') locale?: string,
    @Query('ipCountry') ipCountry?: string,
  ) {
    return this.curriculum.suggestForUser({ locale, ipCountry });
  }
}

@UseGuards(FirebaseAuthGuard)
@Controller('users/me')
export class UserTrackController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Post('track')
  setTrack(@CurrentUser() user: AuthedUser, @Body() dto: SetTrackDto) {
    return this.curriculum.setUserTrack(user.userId, dto.track_id, {
      timezone: dto.timezone,
      examDate: dto.exam_date,
    });
  }
}
