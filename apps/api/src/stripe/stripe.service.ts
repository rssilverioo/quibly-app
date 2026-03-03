import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private priceIds: Record<string, string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', ''),
    );

    this.priceIds = {
      brl_monthly: this.configService.get<string>('STRIPE_PRICE_ID_PRO_BRL', ''),
      brl_yearly: this.configService.get<string>('STRIPE_PRICE_ID_PRO_BRL_YEARLY', ''),
      usd_monthly: this.configService.get<string>('STRIPE_PRICE_ID_PRO_USD', ''),
      usd_yearly: this.configService.get<string>('STRIPE_PRICE_ID_PRO_USD_YEARLY', ''),
    };
  }

  async createCheckout(
    userId: string,
    price: 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly',
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) throw new BadRequestException('User not found');

    const priceId = this.priceIds[price];
    if (!priceId) throw new BadRequestException('Invalid price');

    let customerId = profile.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: profile.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.profile.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = this.configService.get<string>('APP_URL', 'https://tryquibly.com');

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: `${appUrl}/subscription?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { userId },
    });

    return { clientSecret: session.client_secret };
  }

  async createMobileCheckout(
    userId: string,
    price: 'brl_monthly' | 'brl_yearly' | 'usd_monthly' | 'usd_yearly',
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) throw new BadRequestException('User not found');

    const priceId = this.priceIds[price];
    if (!priceId) throw new BadRequestException('Invalid price');

    let customerId = profile.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: profile.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.profile.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create subscription with incomplete status so we get a PaymentIntent
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice'],
      metadata: { userId },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const clientSecret = invoice.confirmation_secret?.client_secret;

    if (!clientSecret) {
      throw new BadRequestException('Could not create payment intent');
    }

    // Create ephemeral key so the mobile SDK can access the customer
    const ephemeralKey = await this.stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2025-10-29.clover' },
    );

    return {
      paymentIntent: clientSecret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      subscriptionId: subscription.id,
    };
  }

  async cancelSubscription(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription');
    }

    await this.stripe.subscriptions.update(profile.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { canceled: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${err}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = invoice.parent?.subscription_details;
        if (subDetails?.subscription) {
          const subId = typeof subDetails.subscription === 'string'
            ? subDetails.subscription
            : subDetails.subscription.id;
          const subscription = await this.stripe.subscriptions.retrieve(subId);
          await this.handleSubscriptionUpdate(subscription);
        }
        break;
      }
    }

    return { received: true };
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const profile = await this.prisma.profile.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!profile) {
      this.logger.warn(`No profile for Stripe customer ${customerId}`);
      return;
    }

    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price?.id || null;
    const isActive = ['active', 'trialing'].includes(subscription.status);
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        subscriptionStatus: subscription.status,
        plan: isActive ? 'PRO' : 'FREE',
        currentPeriodEnd: periodEnd,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    await this.prisma.profile.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        plan: 'FREE',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
      },
    });
  }
}
