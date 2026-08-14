let shuttingDown = false;

export function markShuttingDown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** For testing only — resets the flag between tests. */
export function resetShutdownState(): void {
  shuttingDown = false;
}
