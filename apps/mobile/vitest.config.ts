import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the parts of the app that are plain TypeScript — timing,
 * retry policy, reconciliation. Screens and native modules are not covered
 * here; those need a device, and a simulator wouldn't prove anything about the
 * behaviour that matters (see docs/prompts/F1-mobile-timer-vivo.md).
 *
 * Anything included here must not transitively import React Native.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
