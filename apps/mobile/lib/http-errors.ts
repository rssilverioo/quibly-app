/**
 * HTTP error types, deliberately in their own dependency-free module.
 *
 * `lib/api.ts` pulls in Firebase, which pulls in React Native. Anything that
 * only needs to *classify* a failure — the session heartbeat, retry logic —
 * imports from here instead, so that logic stays unit-testable in plain Node
 * without standing up a React Native environment.
 */

/**
 * An HTTP error that kept its status and body.
 *
 * The previous version threw a bare `Error` carrying only `body.message`, which
 * discarded the two things a caller most often needs: whether the failure is
 * worth retrying (a 500 or a dropped connection, yes; a 400, never) and any
 * structured payload the API sent with the status. The session heartbeat needs
 * the first, and the 409-on-start flow needs the second.
 *
 * Extends `Error` and keeps `message` identical, so every existing
 * `catch (e) { e.message }` in the app behaves exactly as before.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: any = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Worth sending again. Server-side faults and rate limits are transient; a
   * 4xx means the request itself was wrong and will stay wrong.
   */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

/** A request that never reached the server — offline, DNS, timeout. */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Network request failed');
    this.name = 'NetworkError';
  }
}
