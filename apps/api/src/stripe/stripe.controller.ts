import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  RawBodyRequest,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  @UseGuards(FirebaseAuthGuard)
  createCheckout(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.stripeService.createCheckout(user.userId, dto.price);
  }

  @Post('mobile-checkout')
  @UseGuards(FirebaseAuthGuard)
  async createMobileCheckout(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    this.logger.log(`[mobile-checkout] userId=${user.userId} price=${dto.price}`);
    try {
      const result = await this.stripeService.createMobileCheckout(user.userId, dto.price);
      this.logger.log(`[mobile-checkout] SUCCESS userId=${user.userId} customer=${result.customer}`);
      return result;
    } catch (err) {
      this.logger.error(`[mobile-checkout] FAILED userId=${user.userId} error=${err?.message ?? err}`, err?.stack);
      throw err;
    }
  }

  @Post('activate')
  @UseGuards(FirebaseAuthGuard)
  async activateSubscription(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    this.logger.log(`[activate] userId=${user.userId} price=${dto.price}`);
    try {
      const result = await this.stripeService.activateSubscription(user.userId, dto.price);
      this.logger.log(`[activate] SUCCESS userId=${user.userId} sub=${result.subscriptionId}`);
      return result;
    } catch (err) {
      this.logger.error(`[activate] FAILED userId=${user.userId} error=${err?.message ?? err}`, err?.stack);
      throw err;
    }
  }

  @Post('cancel')
  @UseGuards(FirebaseAuthGuard)
  cancelSubscription(@CurrentUser() user: { userId: string }) {
    return this.stripeService.cancelSubscription(user.userId);
  }

  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.stripeService.handleWebhook(req.rawBody!, signature);
  }
}
