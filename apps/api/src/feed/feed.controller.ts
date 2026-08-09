import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeedService } from './feed.service';
import { ReactDto } from './dto/react.dto';
import { CommentDto } from './dto/comment.dto';

@Controller('feed')
@UseGuards(FirebaseAuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get(':leagueId')
  getLeagueFeed(
    @CurrentUser() user: { userId: string; email: string },
    @Param('leagueId') leagueId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.feedService.getLeagueFeed(
      leagueId,
      user.userId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }

  @Post(':postId/react')
  toggleReaction(
    @CurrentUser() user: { userId: string; email: string },
    @Param('postId') postId: string,
    @Body() dto: ReactDto,
  ) {
    return this.feedService.toggleReaction(user.userId, postId, dto.emoji);
  }

  @Post(':postId/comment')
  addComment(
    @CurrentUser() user: { userId: string; email: string },
    @Param('postId') postId: string,
    @Body() dto: CommentDto,
  ) {
    return this.feedService.addComment(user.userId, postId, dto.content);
  }

  /**
   * Anexar foto ao post já publicado.
   *
   * 10MB, o mesmo teto do check-in: é foto de caderno tirada na hora, não
   * galeria. Declarada antes de `:postId` genérico não faz diferença aqui — o
   * caminho tem um segmento a mais —, mas fica junto das outras rotas de post.
   */
  @Post(':postId/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  attachPhoto(
    @CurrentUser() user: { userId: string; email: string },
    @Param('postId') postId: string,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.feedService.attachPhoto(user.userId, postId, photo);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @CurrentUser() user: { userId: string; email: string },
    @Param('commentId') commentId: string,
  ) {
    return this.feedService.deleteComment(user.userId, commentId);
  }

  /**
   * Apagar o próprio post.
   *
   * Declarado **depois** de `comments/:commentId` de propósito: o Nest casa as
   * rotas na ordem em que são declaradas, e `:postId` acima capturaria a
   * palavra "comments" como se fosse um id.
   */
  @Delete(':postId')
  deletePost(
    @CurrentUser() user: { userId: string; email: string },
    @Param('postId') postId: string,
  ) {
    return this.feedService.deletePost(user.userId, postId);
  }

  @Get(':postId/comments')
  getPostComments(
    @Param('postId') postId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.feedService.getPostComments(
      postId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }

  @Patch(':postId/proof-visibility')
  toggleProofPhotoVisibility(
    @CurrentUser() user: { userId: string; email: string },
    @Param('postId') postId: string,
  ) {
    return this.feedService.toggleProofPhotoVisibility(user.userId, postId);
  }
}
