import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(FirebaseAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('start')
  startSession(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: StartSessionDto,
  ) {
    return this.sessionsService.startSession(user.userId, dto);
  }

  @Post('end')
  endSession(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: EndSessionDto,
  ) {
    return this.sessionsService.endSession(user.userId, dto);
  }

  @Post(':id/abandon')
  abandonSession(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionsService.abandonSession(user.userId, id);
  }

  @Get('active')
  getActiveSession(@CurrentUser() user: { userId: string; email: string }) {
    return this.sessionsService.getActiveSession(user.userId);
  }

  @Get()
  getUserSessions(
    @CurrentUser() user: { userId: string; email: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.sessionsService.getUserSessions(user.userId, page, limit);
  }

  @Get('study-dates')
  getStudyDates(
    @CurrentUser() user: { userId: string; email: string },
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.sessionsService.getStudyDates(user.userId, year, month);
  }

  @Get(':id')
  getSessionById(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionsService.getSessionById(id, user.userId);
  }
}
