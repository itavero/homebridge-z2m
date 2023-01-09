import { LogLevel, Logger } from 'homebridge';
import { BasicLogger } from './logger';

export class ConfigurableLogger implements BasicLogger {
  public debugAsInfo = false;

  constructor(private readonly logger: Logger) {}

  info(message: string, ...parameters: unknown[]): void {
    this.logger.info(message, ...parameters);
  }

  warn(message: string, ...parameters: unknown[]): void {
    this.logger.warn(message, ...parameters);
  }

  error(message: string, ...parameters: unknown[]): void {
    this.logger.error(message, ...parameters);
  }

  debug(message: string, ...parameters: unknown[]): void {
    if (this.debugAsInfo) {
      this.logger.info(message, ...parameters);
    } else {
      this.logger.debug(message, ...parameters);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(level: LogLevel, message: string, ...parameters: any[]): void {
    if (this.debugAsInfo && level === LogLevel.DEBUG) {
      level = LogLevel.INFO;
    }
    this.logger.log(level, message, ...parameters);
  }
}
