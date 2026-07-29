import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionsService } from './sessions.service';

/**
 * Periodic job that closes study sessions whose heartbeat went quiet.
 *
 * Split from `SessionsService` so the service stays a plain, directly testable
 * class — the tests drive `sweepStaleSessions()` with an injected clock and
 * never have to stand up Nest's scheduler.
 *
 * ## Running more than one instance
 *
 * There is no distributed lock here. There does not need to be one: each
 * session is claimed by a conditional write inside `finalizeSession`'s
 * transaction, so if two instances sweep the same row at the same moment
 * exactly one wins and the other throws a 400 that `sweepStaleSessions`
 * already swallows and logs. The worst case is duplicated read work for one
 * tick, not double-credited study time.
 *
 * Set `SESSION_SWEEPER_ENABLED=false` to keep an instance from sweeping at all
 * — useful if this ever moves to a dedicated worker dyno.
 */
@Injectable()
export class SessionsSweeper {
  private readonly logger = new Logger(SessionsSweeper.name);
  private readonly enabled: boolean;
  /** Guards against a slow sweep overlapping the next tick on this instance. */
  private running = false;

  constructor(private readonly sessions: SessionsService) {
    this.enabled = process.env.SESSION_SWEEPER_ENABLED !== 'false';
    if (!this.enabled) {
      this.logger.warn('Session sweeper disabled by SESSION_SWEEPER_ENABLED=false');
    }
  }

  /**
   * Every minute. The grace window is five, so a zombie is closed within about
   * six minutes of the app dying — fast enough that the live-peers list in a
   * league stays honest, cheap enough that it is one indexed query per minute.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'sweep-stale-sessions' })
  async handleCron(): Promise<void> {
    if (!this.enabled || this.running) return;

    this.running = true;
    try {
      await this.sessions.sweepStaleSessions();
    } catch (err) {
      // Never let a scheduler tick take the process down.
      this.logger.error(
        `Session sweep failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }
}
