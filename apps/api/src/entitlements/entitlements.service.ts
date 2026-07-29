import { Injectable, Logger } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ENTITLEMENTS, ENTITLEMENT_KEYS, EntitlementKey } from './entitlements.constants';

interface CacheEntry {
  value: number;
  expiresAt: number;
}

/**
 * Resolves plan limits from the `Entitlement` table instead of the old
 * hardcoded `USAGE_LIMITS` constant. The whole point: changing a limit, or
 * turning one on for the first time in Fase 7, is a write to
 * `quibly_entitlements` — never a deploy.
 *
 * A missing (plan, key) row resolves to `DEFAULT_ENTITLEMENTS`, which is
 * Infinity across the board. That is the deliberate Fase 0 state: launch
 * free, with the gate already wired but open.
 *
 * Reads are cached in-process for `ENTITLEMENTS_CACHE_TTL_MS` (default 30s)
 * so a hot path like `generate/*` doesn't pay a DB round trip per request for
 * a number that changes maybe once a quarter. An admin edit via `setLimit`
 * evicts its own cache entry immediately; edits made directly in the DB take
 * up to one TTL window to be observed.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  constructor(private readonly prisma: PrismaService) {
    const configured = Number(process.env.ENTITLEMENTS_CACHE_TTL_MS);
    this.cacheTtlMs = Number.isFinite(configured) && configured >= 0 ? configured : 30_000;
  }

  async getLimit(plan: Plan, key: EntitlementKey): Promise<number> {
    const cacheKey = `${plan}:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    let value: number;
    try {
      const row = await this.prisma.entitlement.findUnique({
        where: { plan_key: { plan, key } },
      });
      value = row ? row.limitValue ?? Infinity : DEFAULT_ENTITLEMENTS[plan][key];
    } catch (err) {
      // Fail open to the documented default rather than 500ing every AI/usage
      // route because the entitlements table hiccuped.
      this.logger.error(
        `Failed to read entitlement ${cacheKey}, falling back to default: ${err instanceof Error ? err.message : err}`,
      );
      value = DEFAULT_ENTITLEMENTS[plan][key];
    }

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.cacheTtlMs });
    return value;
  }

  async getLimits(plan: Plan): Promise<Record<EntitlementKey, number>> {
    const entries = await Promise.all(
      ENTITLEMENT_KEYS.map(async (key) => [key, await this.getLimit(plan, key)] as const),
    );
    return Object.fromEntries(entries) as Record<EntitlementKey, number>;
  }

  /**
   * Admin write path — this is the "change a limit without a deploy" knob.
   * `limitValue: null` means unlimited.
   */
  async setLimit(plan: Plan, key: EntitlementKey, limitValue: number | null): Promise<void> {
    await this.prisma.entitlement.upsert({
      where: { plan_key: { plan, key } },
      create: { plan, key, limitValue },
      update: { limitValue },
    });
    this.cache.delete(`${plan}:${key}`);
  }

  /** All configured + defaulted entitlements, for the admin view. */
  async listAll(): Promise<{ plan: Plan; key: string; limit: number; configured: boolean }[]> {
    const rows = await this.prisma.entitlement.findMany();
    const configured = rows.map((r) => ({
      plan: r.plan,
      key: r.key,
      limit: r.limitValue ?? Infinity,
      configured: true,
    }));
    const configuredSet = new Set(configured.map((c) => `${c.plan}:${c.key}`));

    const plans = Object.keys(DEFAULT_ENTITLEMENTS) as Plan[];
    const defaults = plans.flatMap((plan) =>
      ENTITLEMENT_KEYS.filter((key) => !configuredSet.has(`${plan}:${key}`)).map((key) => ({
        plan,
        key,
        limit: DEFAULT_ENTITLEMENTS[plan][key],
        configured: false,
      })),
    );

    return [...configured, ...defaults];
  }
}
