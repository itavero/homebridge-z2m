import { vi } from 'vitest';
import { ThrottledReporter } from '../src/matter/throttle';

describe('ThrottledReporter', () => {
  const INTERVAL = 60_000;
  let sent: number[];
  let reporter: ThrottledReporter<number>;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    reporter = new ThrottledReporter<number>(INTERVAL, (v) => sent.push(v));
  });

  afterEach(() => {
    reporter.dispose();
    vi.useRealTimers();
  });

  it('sends the first value immediately', () => {
    reporter.submit(1);
    expect(sent).toStrictEqual([1]);
  });

  it('holds back values within the interval and sends the latest one afterwards', () => {
    reporter.submit(1);
    vi.advanceTimersByTime(10_000);
    reporter.submit(2);
    vi.advanceTimersByTime(10_000);
    reporter.submit(3);
    expect(sent).toStrictEqual([1]);

    vi.advanceTimersByTime(39_999);
    expect(sent).toStrictEqual([1]);
    vi.advanceTimersByTime(1);
    expect(sent).toStrictEqual([1, 3]);
  });

  it('sends at most once per interval under a steady stream of updates', () => {
    let value = 0;
    for (let second = 0; second <= 300; second += 5) {
      reporter.submit(value++);
      vi.advanceTimersByTime(5_000);
    }
    // 305 seconds elapsed: the first value and then at most one value per minute.
    expect(sent.length).toBeLessThanOrEqual(6);
    expect(sent.length).toBeGreaterThanOrEqual(5);
    expect(sent[0]).toBe(0);
  });

  it('sends immediately once the interval has elapsed', () => {
    reporter.submit(1);
    vi.advanceTimersByTime(INTERVAL);
    reporter.submit(2);
    expect(sent).toStrictEqual([1, 2]);
  });

  it('drops values equal to the last sent value', () => {
    reporter.submit(1);
    vi.advanceTimersByTime(INTERVAL * 2);
    reporter.submit(1);
    expect(sent).toStrictEqual([1]);
  });

  it('drops a pending value when the value returns to the last sent value', () => {
    reporter.submit(1);
    reporter.submit(2);
    reporter.submit(1);
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(sent).toStrictEqual([1]);
  });

  it('does not send pending values after dispose', () => {
    reporter.submit(1);
    reporter.submit(2);
    reporter.dispose();
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(sent).toStrictEqual([1]);
  });

  it('sends the same value again after invalidate', () => {
    reporter.submit(1);
    reporter.invalidate();
    vi.advanceTimersByTime(INTERVAL);
    reporter.submit(1);
    expect(sent).toStrictEqual([1, 1]);
  });
});
