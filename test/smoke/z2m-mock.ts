import Aedes from 'aedes';
import { createServer, Server } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures');

export class Z2mMockBroker {
  private aedes: Aedes | null = null;
  private server: Server | null = null;
  private baseTopic: string;
  private port: number = 0;

  constructor(baseTopic = 'zigbee2mqtt') {
    this.baseTopic = baseTopic;
  }

  async start(port: number): Promise<void> {
    this.port = port;
    this.aedes = new Aedes();
    this.server = createServer(this.aedes.handle);

    return new Promise((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(port, () => {
        console.log(`[Z2M Mock] MQTT broker started on port ${port}`);
        resolve();
      });
    });
  }

  waitForSubscription(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.aedes) {
        reject(new Error('Broker not started'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Subscription timeout after ${timeout}ms`));
      }, timeout);

      this.aedes.on('subscribe', (subscriptions) => {
        const hasZ2mSubscription = subscriptions.some(
          (s) => s.topic === `${this.baseTopic}/#`
        );
        if (hasZ2mSubscription) {
          clearTimeout(timer);
          console.log(`[Z2M Mock] Plugin subscribed to ${this.baseTopic}/#`);
          resolve();
        }
      });
    });
  }

  async simulateZ2mStartup(): Promise<void> {
    // 1. Bridge comes online
    this.publish('bridge/state', 'online');
    await this.delay(100);

    // 2. Send bridge info
    const info = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'bridge-info.json'), 'utf8')
    );
    this.publish('bridge/info', info);
    await this.delay(100);

    // 3. Send device list
    const devices = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'bridge-devices.json'), 'utf8')
    );
    this.publish('bridge/devices', devices);
    await this.delay(100);

    // 4. Send groups (empty)
    this.publish('bridge/groups', []);
    await this.delay(100);

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
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.aedes) {
            this.aedes.close(() => {
              console.log('[Z2M Mock] Broker stopped');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
