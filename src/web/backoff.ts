const STEPS_MS = [1000, 2000, 4000];
const LONG_WAIT_MS = 5000;

/** Wait before reconnect attempt number `attempt` (0 for the first retry), in milliseconds. */
export function backoffMs(attempt: number): number {
  return STEPS_MS[attempt] ?? LONG_WAIT_MS;
}
