import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('stripe')
export class StripeController {
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
  createMobileCheckout(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.stripeService.createMobileCheckout(user.userId, dto.price);
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
