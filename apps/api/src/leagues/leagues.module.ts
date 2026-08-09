import { Module } from '@nestjs/common';
import { LeaguesController } from './leagues.controller';
import { ConvitePublicoController } from './convite-publico.controller';
import { LeaguesService } from './leagues.service';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [AchievementsModule],
  controllers: [LeaguesController, ConvitePublicoController],
  providers: [LeaguesService],
  exports: [LeaguesService],
})
export class LeaguesModule {}
