import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number;
  period_type?: string;
  store?: string;
}

interface RevenueCatWebhookBody {
  api_version: string;
  event: RevenueCatEvent;
}

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly webhookAuthKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.webhookAuthKey = this.config.getOrThrow('REVENUECAT_WEBHOOK_AUTH_KEY');
  }

  validateAuthKey(authHeader: string | undefined): boolean {
    if (!authHeader) return false;
    return authHeader === this.webhookAuthKey;
  }

  async handleWebhook(body: RevenueCatWebhookBody): Promise<void> {
    const { event } = body;
    const { type, app_user_id: userId } = event;

    this.logger.log(`Webhook event: ${type} for user ${userId}`);

    const platform = this.mapStoreToPlatform(event.store);
    const expirationDate = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION':
        await this.activateSubscription(userId, platform, expirationDate);
        break;

      case 'EXPIRATION':
      case 'CANCELLATION':
        await this.deactivateSubscription(userId);
        break;

      case 'BILLING_ISSUE_DETECTED':
        await this.setBillingIssue(userId);
        break;

      case 'SUBSCRIBER_ALIAS':
      case 'TRANSFER':
      case 'NON_RENEWING_PURCHASE':
        this.logger.log(`Unhandled event type: ${type}`);
        break;

      default:
        this.logger.warn(`Unknown event type: ${type}`);
    }
  }

  private async activateSubscription(
    userId: string,
    platform: string | null,
    expirationDate: Date | null,
  ): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        plan: Plan.PRO,
        subscriptionStatus: 'active',
        subscriptionPlatform: platform,
        currentPeriodEnd: expirationDate,
      },
    });
    this.logger.log(`Activated PRO for user ${userId}`);
  }

  private async deactivateSubscription(userId: string): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        plan: Plan.FREE,
        subscriptionStatus: 'expired',
        currentPeriodEnd: null,
      },
    });
    this.logger.log(`Deactivated PRO for user ${userId}`);
  }

  private async setBillingIssue(userId: string): Promise<void> {
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'billing_issue',
      },
    });
    this.logger.log(`Billing issue for user ${userId}`);
  }

  private mapStoreToPlatform(store?: string): string | null {
    switch (store) {
      case 'APP_STORE':
      case 'MAC_APP_STORE':
        return 'apple';
      case 'PLAY_STORE':
        return 'google';
      case 'STRIPE':
        return 'stripe';
      default:
        return null;
    }
  }
}
