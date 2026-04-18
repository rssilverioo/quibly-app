import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { FocusAreasService } from './focus-areas.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class AddFocusDto {
  @IsString() topic: string;
}

class StudyNoteDto {
  @IsString() topic: string;
}

@UseGuards(FirebaseAuthGuard)
@Controller('focus-areas')
export class FocusAreasController {
  constructor(private readonly service: FocusAreasService) {}

  @Get()
  getAreas(@CurrentUser() user: { userId: string }) {
    return this.service.getFocusAreas(user.userId);
  }

  @Post('add')
  addManual(
    @CurrentUser() user: { userId: string },
    @Body() dto: AddFocusDto,
  ) {
    return this.service.addManualFocus(user.userId, dto.topic);
  }

  @Post('study-note')
  getStudyNote(
    @CurrentUser() user: { userId: string },
    @Body() dto: StudyNoteDto,
  ) {
    return this.service.generateStudyNote(user.userId, dto.topic);
  }
}
