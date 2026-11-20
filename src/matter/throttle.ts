/**
 * Forwards values at most once per interval.
 *
 * The first value is sent immediately. Values submitted within the interval after a send are held back,
 * and only the most recent one is sent once the interval has elapsed. Values equal to the last sent value
 * are dropped.
 */
export class ThrottledReporter<T> {
  private lastSentAt: number | undefined;
  private lastSentValue: T | undefined;
  private hasPending = false;
  private pendingValue: T | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly intervalMs: number,
    private readonly send: (value: T) => void
  ) {}

  submit(value: T): void {
    if (this.lastSentAt !== undefined && value === this.lastSentValue) {
      // Nothing new to report; drop any pending (older) value as well.
      this.clearPending();
      return;
    }

    const now = Date.now();
    if (this.lastSentAt === undefined || now - this.lastSentAt >= this.intervalMs) {
      this.clearPending();
      this.emit(value, now);
      return;
    }

    this.hasPending = true;
    this.pendingValue = value;
    if (this.timer === undefined) {
      this.timer = setTimeout(() => this.flush(), this.intervalMs - (now - this.lastSentAt));
      this.timer.unref?.();
    }
  }

  dispose(): void {
    this.clearPending();
  }

  private flush(): void {
    this.timer = undefined;
    if (this.hasPending) {
      const value = this.pendingValue as T;
      this.hasPending = false;
      this.pendingValue = undefined;
      this.emit(value, Date.now());
    }
  }

  private emit(value: T, now: number): void {
    this.lastSentAt = now;
    this.lastSentValue = value;
    this.send(value);
  }

  private clearPending(): void {
    this.hasPending = false;
    this.pendingValue = undefined;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
