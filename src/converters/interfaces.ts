import { Logger, Service } from 'homebridge';
import { ExposesEntry } from '../z2mModels';

export interface BasicAccessory {
    log: BasicLogger;

    displayName: string;

    getDefaultServiceDisplayName(subType: string | undefined): string;

    getOrAddService(service: Service): Service;

    queueDataForSetAction(data: Record<string, unknown>): void;

    queueKeyForGetAction(key: string | string[]): void;

    isPropertyExcluded(property: string | undefined): boolean;

    isValueAllowedForProperty(property: string, value: string): boolean;

    registerServiceHandler(handler: ServiceHandler): void;

    isServiceHandlerIdKnown(identifier: string): boolean;

    isExperimentalFeatureEnabled(feature: string): boolean;

    getServiceConfiguration(tag: string): unknown | undefined;
}

export interface ServiceHandler {
    identifier: string;
    getableKeys: string[];
    updateState(state: Record<string, unknown>): void;
}

export interface ServiceConfigurationRegistry {
    registerServiceConfiguration(tag: string, validator: ServiceConfigurationValidator): void;
}

export interface ServiceConfigurationValidator {
    isValidServiceConfiguration(tag: string, config: unknown, logger: Logger | undefined): boolean;
}

export interface ServiceCreator {
    createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void;
}

export interface BasicLogger {
    info(message: string, ...parameters: unknown[]): void;
    warn(message: string, ...parameters: unknown[]): void;
    error(message: string, ...parameters: unknown[]): void;
    debug(message: string, ...parameters: unknown[]): void;
}