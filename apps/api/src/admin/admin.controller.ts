import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('plan') plan?: 'FREE' | 'PRO',
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, plan, sort });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Get('revenue')
  getRevenue() {
    return this.adminService.getRevenue();
  }

  @Get('growth')
  getGrowth(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.adminService.getGrowth(days);
  }

  @Get('flashcard-sets')
  getFlashcardSets(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getFlashcardSets({ page, limit, search, userId });
  }

  @Get('flashcard-sets/:id')
  getFlashcardSet(@Param('id') id: string) {
    return this.adminService.getFlashcardSet(id);
  }

  @Get('quizzes')
  getQuizzes(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getQuizzes({ page, limit, search, userId });
  }

  @Get('quizzes/:id')
  getQuiz(@Param('id') id: string) {
    return this.adminService.getQuiz(id);
  }

  @Get('leagues')
  getLeagues(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getLeagues({ page, limit, status, search });
  }

  @Get('leagues/:id')
  getLeague(@Param('id') id: string) {
    return this.adminService.getLeague(id);
  }

  @Get('documents')
  getDocuments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getDocuments({ page, limit, search, userId });
  }

  @Post('notifications/broadcast')
  broadcast(
    @Body() body: { title: string; body: string; segment: 'all' | 'pro' | 'free' },
  ) {
    return this.notificationsService.broadcastToSegment(
      body.title,
      body.body,
      body.segment,
    );
  }
}
