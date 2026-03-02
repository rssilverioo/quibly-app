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
import { QuizzesService } from './quizzes.service';

@Controller('quizzes')
@UseGuards(FirebaseAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.quizzesService.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzesService.get(user.userId, id);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzesService.delete(user.userId, id);
  }
}
