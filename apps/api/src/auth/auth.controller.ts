import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CreateProfileDto } from './dto/create-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: { userId: string; email: string }) {
    return this.authService.getProfile(user.userId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('profile')
  createProfile(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: CreateProfileDto,
  ) {
    return this.authService.createProfile(
      user.userId,
      user.email,
      dto.username,
      dto.handle,
    );
  }
}
