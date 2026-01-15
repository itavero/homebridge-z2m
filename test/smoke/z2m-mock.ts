/* eslint-disable no-console */
import Aedes from 'aedes';
import { createServer, Server } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures');

/**
 * Delay between Z2M messages during startup simulation.
 * Real Z2M sends messages with slight delays; this mimics that behavior
 * and gives the plugin time to process each message.
 */
const Z2M_MESSAGE_DELAY_MS = 100;

/** Default timeout waiting for plugin to subscribe to MQTT topics */
const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 10000;

export class Z2mMockBroker {
  private aedes: Aedes | null = null;
  private server: Server | null = null;
  private baseTopic: string;
  private port = 0;

  constructor(baseTopic = 'zigbee2mqtt') {
    this.baseTopic = baseTopic;
  }

  /**
   * Start the MQTT broker. Pass port 0 to auto-assign an available port.
   * @returns The actual port the broker is listening on
   */
  async start(port = 0): Promise<number> {
    this.aedes = new Aedes();
    this.server = createServer(this.aedes.handle);

    return new Promise((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      this.server!.on('error', onError);
      this.server!.listen(port, () => {
        // Remove the startup error handler and add a persistent one for runtime errors
        this.server!.off('error', onError);
        this.server!.on('error', (err) => console.error('[Z2M Mock] Server error:', err));

        const addr = this.server!.address();
        this.port = typeof addr === 'object' && addr ? addr.port : port;
        console.log(`[Z2M Mock] MQTT broker started on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  waitForSubscription(timeout = DEFAULT_SUBSCRIPTION_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.aedes) {
        reject(new Error('Broker not started'));
        return;
      }

      const timer = setTimeout(() => {
        this.aedes?.off('subscribe', handler);
        reject(new Error(`Subscription timeout after ${timeout}ms`));
      }, timeout);

      const handler = (subscriptions: { topic: string }[]) => {
        const hasZ2mSubscription = subscriptions.some((s) => s.topic === `${this.baseTopic}/#`);
        if (hasZ2mSubscription) {
          clearTimeout(timer);
          this.aedes?.off('subscribe', handler);
          console.log(`[Z2M Mock] Plugin subscribed to ${this.baseTopic}/#`);
          resolve();
        }
      };

      this.aedes.on('subscribe', handler);
    });
  }

  async simulateZ2mStartup(): Promise<void> {
    // 1. Bridge comes online (z2m 2.0+ uses JSON format)
    this.publish('bridge/state', { state: 'online' });
    await this.delay(Z2M_MESSAGE_DELAY_MS);

    // 2. Send bridge info
    const info = JSON.parse(readFileSync(join(FIXTURES_DIR, 'bridge-info.json'), 'utf8'));
    this.publish('bridge/info', info);
    await this.delay(Z2M_MESSAGE_DELAY_MS);

    // 3. Send device list
    const devices = JSON.parse(readFileSync(join(FIXTURES_DIR, 'bridge-devices.json'), 'utf8'));
    this.publish('bridge/devices', devices);
    await this.delay(Z2M_MESSAGE_DELAY_MS);

    // 4. Send groups (empty)
    this.publish('bridge/groups', []);
    await this.delay(Z2M_MESSAGE_DELAY_MS);

    // 5. Send initial device states
    this.publish('test_light', { state: 'OFF', brightness: 254 });
    this.publish('test_sensor', { temperature: 22.5, humidity: 45, battery: 95 });

    console.log('[Z2M Mock] Startup sequence complete');
  }

  publish(topic: string, payload: unknown): void {
    if (!this.aedes) {
      throw new Error('Broker not started');
    }

    const fullTopic = `${this.baseTopic}/${topic}`;
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

    this.aedes.publish(
      {
        topic: fullTopic,
        payload: Buffer.from(message),
        qos: 0,
        retain: false,
        cmd: 'publish',
        dup: false,
      },
      (err) => {
        if (err) {
          console.error(`[Z2M Mock] Error publishing to ${fullTopic}:`, err);
        }
      }
    );
    console.log(`[Z2M Mock] Published: ${fullTopic}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    const done = () => {
      console.log('[Z2M Mock] Broker stopped');
      this.server = null;
      this.aedes = null;
    };

    // Close aedes first, then server
    if (this.aedes) {
      await new Promise<void>((resolve) => this.aedes!.close(() => resolve()));
    }
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
    done();
  }
}
