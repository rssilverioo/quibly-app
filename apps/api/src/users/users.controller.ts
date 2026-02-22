import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: { userId: string; email: string }) {
    return this.usersService.getProfile(user.userId);
  }

  @Get('me/stats')
  getMyStats(@CurrentUser() user: { userId: string; email: string }) {
    return this.usersService.getStats(user.userId);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() user: { userId: string; email: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(user.userId, file);
  }

  @Get('search')
  searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query);
  }

  @Get(':handle')
  getProfileByHandle(@Param('handle') handle: string) {
    return this.usersService.getProfileByHandle(handle);
  }
}
