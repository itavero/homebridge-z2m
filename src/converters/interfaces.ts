import { Characteristic, Logger, Service } from 'homebridge';
import { ExposesEntry } from '../z2mModels';
import { BasicLogger } from '../logger';

export interface BasicAccessory {
  log: BasicLogger;

  displayName: string;

  getDefaultServiceDisplayName(subType: string | undefined): string;

  getOrAddService(service: Service): Service;

  queueDataForSetAction(data: Record<string, unknown>): void;

  queueKeyForGetAction(key: string | string[]): void;

  registerServiceHandler(handler: ServiceHandler): void;

  isServiceHandlerIdKnown(identifier: string): boolean;

  isExperimentalFeatureEnabled(feature: string): boolean;

  getConverterConfiguration(tag: string): unknown | undefined;
}

export interface ServiceHandler {
  mainCharacteristics: (Characteristic | undefined)[];
  identifier: string;
  getableKeys: string[];
  updateState(state: Record<string, unknown>): void;
}

export interface ConverterConfigurationRegistry {
  registerConverterConfiguration(tag: string, validator: (config: unknown, tag: string, logger: Logger | undefined) => boolean): void;
}

export interface ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}
