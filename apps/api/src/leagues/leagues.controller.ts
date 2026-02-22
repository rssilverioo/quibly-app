import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';
import { RematchDto } from './dto/rematch.dto';

@Controller('leagues')
@UseGuards(FirebaseAuthGuard)
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: CreateLeagueDto,
  ) {
    return this.leaguesService.create(user.userId, dto);
  }

  @Get()
  findUserLeagues(@CurrentUser() user: { userId: string; email: string }) {
    return this.leaguesService.findUserLeagues(user.userId);
  }

  @Get('invite/:code')
  previewByInviteCode(
    @CurrentUser() user: { userId: string; email: string },
    @Param('code') code: string,
  ) {
    return this.leaguesService.previewByInviteCode(code, user.userId);
  }

  @Get(':id')
  findById(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.leaguesService.findById(id, user.userId);
  }

  @Patch(':id')
  updateLeague(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: UpdateLeagueDto,
  ) {
    return this.leaguesService.updateLeague(user.userId, id, dto);
  }

  @Post('join')
  joinByInviteCode(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: JoinLeagueDto,
  ) {
    return this.leaguesService.joinByInviteCode(user.userId, dto.invite_code, dto.display_name);
  }

  @Post(':id/leave')
  leaveLeague(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') id: string,
  ) {
    return this.leaguesService.leaveLeague(user.userId, id);
  }

  @Get(':id/leaderboard')
  getLeaderboard(
    @Param('id') id: string,
    @Query('period') period: 'weekly' | 'monthly' | 'all_time' = 'all_time',
  ) {
    return this.leaguesService.getLeaderboard(id, period);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.leaguesService.getMembers(id);
  }

  @Get(':id/results')
  getEndResults(@Param('id') id: string) {
    return this.leaguesService.getEndResults(id);
  }

  @Post(':id/rematch')
  rematch(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') id: string,
    @Body() dto: RematchDto,
  ) {
    return this.leaguesService.rematch(user.userId, id, dto);
  }
}
