import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LessonsService } from './lessons.service';
import { GenerateService } from '../generate/generate.service';
import { CaptureLessonDto } from './dto/capture-lesson.dto';
import { AskLessonDto } from './dto/ask-lesson.dto';

@Controller('lessons')
@UseGuards(FirebaseAuthGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly generateService: GenerateService,
  ) {}

  /** Audio recording, PDF or photo — the service routes on mime type. */
  @Post('capture')
  // Transcription/OCR of a whole file: the most expensive route in the app.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  capture(
    @CurrentUser() user: { userId: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CaptureLessonDto,
  ) {
    return this.lessonsService.capture(user.userId, file, {
      title: dto.title,
      subject: dto.subject,
      language: dto.language,
      durationSec: dto.duration_sec ? Number(dto.duration_sec) : undefined,
    });
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.lessonsService.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lessonsService.get(user.userId, id);
  }

  @Post(':id/flashcards')
  generateFlashcards(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.generateService.generateFromLesson(user.userId, id, 'flashcards');
  }

  @Post(':id/quiz')
  generateQuiz(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.generateService.generateFromLesson(user.userId, id, 'quiz');
  }

  @Post(':id/ask')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  ask(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AskLessonDto,
  ) {
    return this.lessonsService.ask(user.userId, id, dto.question);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lessonsService.remove(user.userId, id);
  }
}
