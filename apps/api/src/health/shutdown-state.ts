import { Injectable } from "@nestjs/common";

@Injectable()
export class ShutdownState {
  private shuttingDown = false;

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /** For testing only — resets the flag between tests. */
  reset(): void {
    this.shuttingDown = false;
  }
}
