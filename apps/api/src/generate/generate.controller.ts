import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GenerateService } from './generate.service';
import { GenerateFromDocumentDto } from './dto/generate-from-document.dto';
import { GenerateFromTopicDto } from './dto/generate-from-topic.dto';

@Controller('generate')
@UseGuards(FirebaseAuthGuard)
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
}
