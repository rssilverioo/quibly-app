import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FlashcardsService } from './flashcards.service';

@Controller('flashcard-sets')
@UseGuards(FirebaseAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.flashcardsService.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashcardsService.get(user.userId, id);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashcardsService.delete(user.userId, id);
  }
}
