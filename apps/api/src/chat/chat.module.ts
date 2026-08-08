import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatRetentionSweeper } from './chat-retention.sweeper';

@Module({
  imports: [ModerationModule],
  controllers: [ChatController],
  // O gateway é provider, e não só uma classe solta: é o Nest que o instancia e
  // injeta no `ChatService`, que é quem anuncia mensagem nova e mensagem
  // apagada depois de gravar.
  providers: [ChatService, ChatGateway, ChatRetentionSweeper],
  exports: [ChatService],
})
export class ChatModule {}
