import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsOptional } from 'class-validator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GenerateService } from './generate.service';
import { GenerateFromDocumentDto } from './dto/generate-from-document.dto';
import { GenerateFromTopicDto } from './dto/generate-from-topic.dto';

class ExplainDto {
  @IsString() front: string;
  @IsString() back: string;
  @IsString() @IsOptional() explain?: string;
  @IsString() @IsOptional() language?: string;
}

@Controller('generate')
@UseGuards(FirebaseAuthGuard)
// Every route here calls an LLM — each request costs real money, so the
// per-route limit is far tighter than the app-wide default.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class GenerateController {
  constructor(private readonly generateService: GenerateService) {}

  @Post('flashcards')
  generateFlashcards(
    @CurrentUser() user: { userId: string },
    @Body() dto: GenerateFromDocumentDto,
  ) {
    return this.generateService.generateFlashcardsFromDocument(
      user.userId,
      dto.document_id,
      dto.language,
    );
  }

  @Post('quiz')
  generateQuiz(
    @CurrentUser() user: { userId: string },
    @Body() dto: GenerateFromDocumentDto,
  ) {
    return this.generateService.generateQuizFromDocument(
      user.userId,
      dto.document_id,
      dto.language,
    );
  }

  @Post('topic')
  generateFromTopic(
    @CurrentUser() user: { userId: string },
    @Body() dto: GenerateFromTopicDto,
  ) {
    return this.generateService.generateFromTopic(
      user.userId,
      dto.topic,
      dto.type,
      dto.language,
    );
  }

  @Post('explain')
  explain(@Body() dto: ExplainDto) {
    return this.generateService.explainCard(dto.front, dto.back, dto.explain, dto.language);
  }
}
