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
import { EndSessionDto, LegacyEndSessionDto } from './dto/end-session.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthedUser = { userId: string; email: string };

/**
 * Session lifecycle. The contract is documented in docs/API-SESSIONS.md — the
 * mobile squad builds the iOS Live Activity and the Android Foreground Service
 * against that document, so any change here has to land there too.
 */
@UseGuards(FirebaseAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('start')
  startSession(@CurrentUser() user: AuthedUser, @Body() dto: StartSessionDto) {
    return this.sessionsService.startSession(user.userId, dto);
  }

  /**
   * Keep-alive, every 30s while a session is live. Returns the server's
   * elapsed count so the client renders a number it does not own.
   */
  @Post(':id/heartbeat')
  heartbeat(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.heartbeat(user.userId, id);
  }

  @Post(':id/pause')
  pauseSession(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.pauseSession(user.userId, id);
  }

  @Post(':id/resume')
  resumeSession(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.resumeSession(user.userId, id);
  }

  /**
   * Finish and score. The only thing the body may carry is which topics were
   * studied — every number still comes from the server.
   */
  @Post(':id/end')
  endSession(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.sessionsService.endSession(user.userId, id, dto.topic_ids ?? []);
  }

  /** Throw the session away. Scores nothing, unlike `end`. */
  @Post(':id/abandon')
  abandonSession(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.abandonSession(user.userId, id);
  }

  /**
   * @deprecated Use `POST /sessions/:id/end`.
   *
   * v1.2.1 is live in the store and posts here with the duration in the body.
   * The body is accepted and ignored — the duration is measured server-side
   * either way — so old installs keep working instead of taking a 400 the
   * moment this deploys. Remove once the store minimum passes the release that
   * moves to the `:id/end` route.
   */
  @Post('end')
  endSessionLegacy(@CurrentUser() user: AuthedUser, @Body() dto: LegacyEndSessionDto) {
    return this.sessionsService.endSession(user.userId, dto.session_id);
  }

  @Get('active')
  getActiveSession(@CurrentUser() user: AuthedUser) {
    return this.sessionsService.getActiveSession(user.userId);
  }

  @Get()
  getUserSessions(
    @CurrentUser() user: AuthedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.sessionsService.getUserSessions(user.userId, page, limit);
  }

  @Get('study-dates')
  getStudyDates(
    @CurrentUser() user: AuthedUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.sessionsService.getStudyDates(user.userId, year, month);
  }

  @Get(':id')
  getSessionById(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getSessionById(id, user.userId);
  }
}
