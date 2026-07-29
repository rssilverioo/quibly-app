import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ENTITLEMENT_KEYS, EntitlementKey } from '../entitlements/entitlements.constants';

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notificationsService: NotificationsService,
    private readonly entitlementsService: EntitlementsService,
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

  // ─── AI cost (Fase 0, Bloco 4) ───

  @Get('ai-costs')
  getAiCostsByDay(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.adminService.getAiCostsByDay(days);
  }

  @Get('ai-costs/users')
  getAiCostsByUser(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAiCostsByUser({ days, page, limit });
  }

  // ─── Entitlements (Fase 0, Bloco 3) ───
  //
  // This is the "change a limit without a deploy" knob the roadmap asks for.
  // At launch every plan/key resolves to Infinity by default (see
  // EntitlementsService) — these routes are how that gets turned into a
  // finite limit later, by writing a row instead of shipping code.

  @Get('entitlements')
  listEntitlements() {
    return this.entitlementsService.listAll();
  }

  @Patch('entitlements')
  setEntitlement(
    @Body() body: { plan: Plan; key: string; limit: number | null },
  ) {
    if (body.plan !== 'FREE' && body.plan !== 'PRO') {
      throw new BadRequestException(`Unknown plan "${body.plan}"`);
    }
    if (!ENTITLEMENT_KEYS.includes(body.key as EntitlementKey)) {
      throw new BadRequestException(`Unknown entitlement key "${body.key}"`);
    }
    return this.entitlementsService
      .setLimit(body.plan, body.key as EntitlementKey, body.limit)
      .then(() => ({ ok: true }));
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
