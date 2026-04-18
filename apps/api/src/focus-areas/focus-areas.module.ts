import { Module } from '@nestjs/common';
import { FocusAreasController } from './focus-areas.controller';
import { FocusAreasService } from './focus-areas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FocusAreasController],
  providers: [FocusAreasService],
})
export class FocusAreasModule {}
