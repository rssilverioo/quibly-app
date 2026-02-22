import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReactDto } from './dto/react.dto';

@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':leagueId')
  getMessages(
    @CurrentUser() user: { userId: string; email: string },
    @Param('leagueId') leagueId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(
      leagueId,
      user.userId,
      cursor,
      limit ? Number(limit) : 50,
    );
  }

  @Post(':leagueId')
  sendMessage(
    @CurrentUser() user: { userId: string; email: string },
    @Param('leagueId') leagueId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.userId, leagueId, dto.content);
  }

  @Post('messages/:messageId/react')
  toggleReaction(
    @CurrentUser() user: { userId: string; email: string },
    @Param('messageId') messageId: string,
    @Body() dto: ReactDto,
  ) {
    return this.chatService.toggleReaction(user.userId, messageId, dto.emoji);
  }

  @Delete('messages/:messageId')
  deleteMessage(
    @CurrentUser() user: { userId: string; email: string },
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(user.userId, messageId);
  }
}
