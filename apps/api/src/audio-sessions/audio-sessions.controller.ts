import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AudioSessionsService } from './audio-sessions.service';
import { CreateAudioSessionDto } from './dto/create-audio-session.dto';
import { StartAudioSessionDto } from './dto/start-audio-session.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(FirebaseAuthGuard)
@Controller('audio-sessions')
export class AudioSessionsController {
  constructor(private readonly service: AudioSessionsService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateAudioSessionDto,
  ) {
    return this.service.createSession(user.userId, dto);
  }

  @Get(':id')
  get(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getSession(user.userId, id);
  }

  @Post(':id/start')
  start(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartAudioSessionDto,
  ) {
    return this.service.startSession(user.userId, id, dto);
  }
}
