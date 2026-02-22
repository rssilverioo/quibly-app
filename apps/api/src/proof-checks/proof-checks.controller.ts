import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProofChecksService } from './proof-checks.service';

@Controller('proof-checks')
@UseGuards(FirebaseAuthGuard)
export class ProofChecksController {
  constructor(private readonly proofChecksService: ProofChecksService) {}

  @Post('trigger/:sessionId')
  triggerCheck(
    @CurrentUser() user: { userId: string; email: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.proofChecksService.triggerCheck(user.userId, sessionId);
  }

  @Get('pending/:sessionId')
  getPendingChecks(
    @CurrentUser() user: { userId: string; email: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.proofChecksService.getPendingChecks(user.userId, sessionId);
  }

  @Post(':id/submit')
  @UseInterceptors(FileInterceptor('photo'))
  submitProof(
    @CurrentUser() user: { userId: string; email: string },
    @Param('id') proofCheckId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.proofChecksService.submitProof(
      user.userId,
      proofCheckId,
      file,
    );
  }

  @Get('session/:sessionId')
  getSessionChecks(
    @CurrentUser() user: { userId: string; email: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.proofChecksService.getSessionChecks(sessionId, user.userId);
  }
}
