import { Module } from '@nestjs/common';
import { ProofChecksController } from './proof-checks.controller';
import { ProofChecksService } from './proof-checks.service';

@Module({
  controllers: [ProofChecksController],
  providers: [ProofChecksService],
  exports: [ProofChecksService],
})
export class ProofChecksModule {}
