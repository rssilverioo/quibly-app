import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(FirebaseAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string; email: string }) {
    return this.roomsService.listForUser(user.userId);
  }
}
