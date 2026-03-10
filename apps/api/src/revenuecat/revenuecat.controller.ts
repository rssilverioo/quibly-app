import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { RevenueCatService } from './revenuecat.service';

@Controller('revenuecat')
export class RevenueCatController {
  private readonly logger = new Logger(RevenueCatController.name);

  constructor(private readonly revenueCatService: RevenueCatService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    if (!this.revenueCatService.validateAuthKey(authHeader)) {
      throw new UnauthorizedException('Invalid webhook auth key');
    }

    try {
      await this.revenueCatService.handleWebhook(body);
    } catch (error) {
      this.logger.error('Webhook processing error:', error);
    }

    return { ok: true };
  }
}
