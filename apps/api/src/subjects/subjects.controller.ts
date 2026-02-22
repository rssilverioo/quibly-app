import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(FirebaseAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: CreateSubjectDto,
  ) {
    return this.subjectsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { userId: string; email: string }) {
    return this.subjectsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.subjectsService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.subjectsService.delete(id, user.userId);
  }
}
