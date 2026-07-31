import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeedService } from '../feed/feed.service';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateRoomPostDto } from './dto/create-room-post.dto';

@Controller('rooms')
@UseGuards(FirebaseAuthGuard)
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly feedService: FeedService,
  ) {}

  @Get()
  list(@CurrentUser() user: { userId: string; email: string }) {
    return this.roomsService.listForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.create(user.userId, dto);
  }

  @Get(':id/feed')
  feed(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') roomId: string,
    @Query('page') rawPage = '1',
    @Query('limit') rawLimit = '20',
  ) {
    const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit, 10) || 20));
    return this.feedService.getLeagueFeed(roomId, user.userId, page, limit);
  }

  @Post(':id/posts')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  createPost(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') roomId: string,
    @Body() dto: CreateRoomPostDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.roomsService.createPost(roomId, user.userId, dto.caption, photo);
  }
}
