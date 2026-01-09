import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import { ExposesEntry, ExposesEntryWithProperty, exposesHasProperty, exposesIsPublished, ExposesKnownTypes } from '../z2mModels';
import { groupByEndpoint } from '../helpers';
import { CharacteristicMonitor, PassthroughCharacteristicMonitor } from './monitor';
import { Characteristic, Service } from 'homebridge';
import { hap } from '../hap';
import { BasicLogger } from '../logger';

// Custom Service UUID (from homebridge-3em-energy-meter, proven in Eve app)
const ELECTRICAL_SERVICE_UUID = '00000001-0000-1777-8000-775D67EC4377';

// Eve Characteristic UUIDs
const CHARACTERISTIC_WATT_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_VOLT_UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_AMPERE_UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';
const CHARACTERISTIC_KWH_UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

// Characteristic Names
const CHARACTERISTIC_WATT_NAME = 'Consumption';
const CHARACTERISTIC_VOLT_NAME = 'Voltage';
const CHARACTERISTIC_AMPERE_NAME = 'Current';
const CHARACTERISTIC_KWH_NAME = 'Total Consumption';
const CHARACTERISTIC_PRODUCED_KWH_NAME = 'Total Production';

// Property names with fallbacks (first match wins)
const POWER_NAMES = ['power', 'active_power', 'load'];
const VOLTAGE_NAMES = ['voltage', 'mains_voltage', 'rms_voltage'];
const CURRENT_NAMES = ['current'];
const ENERGY_CONSUMED_NAMES = ['energy', 'consumed_energy', 'energy_consumed', 'energy_wh'];
const ENERGY_PRODUCED_NAMES = ['produced_energy', 'energy_produced'];

// All electrical property names (for filtering)
const ALL_ELECTRICAL_NAMES = [...POWER_NAMES, ...VOLTAGE_NAMES, ...CURRENT_NAMES, ...ENERGY_CONSUMED_NAMES, ...ENERGY_PRODUCED_NAMES];

interface ElectricalExposes {
  power?: ExposesEntryWithProperty;
  voltage?: ExposesEntryWithProperty;
  current?: ExposesEntryWithProperty;
  energy?: ExposesEntryWithProperty;
}

function findExpose(exposes: ExposesEntryWithProperty[], names: string[]): ExposesEntryWithProperty | undefined {
  for (const name of names) {
    const found = exposes.find((e) => e.name === name && e.type === ExposesKnownTypes.NUMERIC);
    if (found) {
      return found;
    }
  }
  return undefined;
}

// Helper functions to create characteristics (following air_pressure.ts pattern)
function createWattCharacteristic(): Characteristic {
  const characteristic = new hap.Characteristic(CHARACTERISTIC_WATT_NAME, CHARACTERISTIC_WATT_UUID, {
    format: hap.Formats.FLOAT,
    perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
    minValue: 0,
    maxValue: 65535,
    minStep: 0.1,
  });
  characteristic.value = 0;
  return characteristic;
}

function createVoltCharacteristic(): Characteristic {
  const characteristic = new hap.Characteristic(CHARACTERISTIC_VOLT_NAME, CHARACTERISTIC_VOLT_UUID, {
    format: hap.Formats.FLOAT,
    perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
    minValue: 0,
    maxValue: 500,
    minStep: 0.1,
  });
  characteristic.value = 0;
  return characteristic;
}

function createAmpereCharacteristic(): Characteristic {
  const characteristic = new hap.Characteristic(CHARACTERISTIC_AMPERE_NAME, CHARACTERISTIC_AMPERE_UUID, {
    format: hap.Formats.FLOAT,
    perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
    minValue: 0,
    maxValue: 100,
    minStep: 0.001,
  });
  characteristic.value = 0;
  return characteristic;
}

function createKilowattHourCharacteristic(): Characteristic {
  const characteristic = new hap.Characteristic(CHARACTERISTIC_KWH_NAME, CHARACTERISTIC_KWH_UUID, {
    format: hap.Formats.FLOAT,
    perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
    minValue: 0,
    maxValue: 4294967295,
    minStep: 0.001,
  });
  characteristic.value = 0;
  return characteristic;
}

function createProducedKilowattHourCharacteristic(): Characteristic {
  const characteristic = new hap.Characteristic(CHARACTERISTIC_PRODUCED_KWH_NAME, CHARACTERISTIC_KWH_UUID, {
    format: hap.Formats.FLOAT,
    perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
    minValue: 0,
    maxValue: 4294967295,
    minStep: 0.001,
  });
  characteristic.value = 0;
  return characteristic;
}

function createElectricalSensorService(displayName: string, subtype?: string): Service {
  return new hap.Service(displayName, ELECTRICAL_SERVICE_UUID, subtype);
}

export class ElectricalSensorHandler implements ServiceHandler {
  protected log: BasicLogger;
  protected monitors: CharacteristicMonitor[] = [];
  protected service: Service;
  protected serviceName: string;
  identifier = '';

  private powerExpose?: ExposesEntryWithProperty;
  private voltageExpose?: ExposesEntryWithProperty;
  private currentExpose?: ExposesEntryWithProperty;
  private energyExpose?: ExposesEntryWithProperty;

  constructor(accessory: BasicAccessory, electricalExposes: ElectricalExposes, endpoint: string | undefined) {
    this.log = accessory.log;
    this.serviceName = accessory.getDefaultServiceDisplayName(endpoint);
    this.identifier = ElectricalSensorHandler.generateIdentifier(endpoint);

    this.service = accessory.getOrAddService(createElectricalSensorService(this.serviceName, endpoint));

    accessory.log.debug(`Configuring ElectricalSensor for ${this.serviceName}`);

    // Add characteristics based on available exposes
    if (electricalExposes.power) {
      this.powerExpose = electricalExposes.power;
      this.service.addCharacteristic(createWattCharacteristic());
      this.monitors.push(new PassthroughCharacteristicMonitor(electricalExposes.power.property, this.service, CHARACTERISTIC_WATT_NAME));
    }

    if (electricalExposes.voltage) {
      this.voltageExpose = electricalExposes.voltage;
      this.service.addCharacteristic(createVoltCharacteristic());
      this.monitors.push(new PassthroughCharacteristicMonitor(electricalExposes.voltage.property, this.service, CHARACTERISTIC_VOLT_NAME));
    }

    if (electricalExposes.current) {
      this.currentExpose = electricalExposes.current;
      this.service.addCharacteristic(createAmpereCharacteristic());
      this.monitors.push(
        new PassthroughCharacteristicMonitor(electricalExposes.current.property, this.service, CHARACTERISTIC_AMPERE_NAME)
      );
    }

    if (electricalExposes.energy) {
      this.energyExpose = electricalExposes.energy;
      this.service.addCharacteristic(createKilowattHourCharacteristic());
      this.monitors.push(new PassthroughCharacteristicMonitor(electricalExposes.energy.property, this.service, CHARACTERISTIC_KWH_NAME));
    }
  }

  get mainCharacteristics(): (Characteristic | undefined)[] {
    const characteristics: (Characteristic | undefined)[] = [];
    if (this.powerExpose) {
      characteristics.push(this.service.getCharacteristic(CHARACTERISTIC_WATT_NAME));
    }
    if (this.voltageExpose) {
      characteristics.push(this.service.getCharacteristic(CHARACTERISTIC_VOLT_NAME));
    }
    if (this.currentExpose) {
      characteristics.push(this.service.getCharacteristic(CHARACTERISTIC_AMPERE_NAME));
    }
    if (this.energyExpose) {
      characteristics.push(this.service.getCharacteristic(CHARACTERISTIC_KWH_NAME));
    }
    return characteristics;
  }

  get getableKeys(): string[] {
    const keys: string[] = [];
    if (this.powerExpose) {
      keys.push(this.powerExpose.property);
    }
    if (this.voltageExpose) {
      keys.push(this.voltageExpose.property);
    }
    if (this.currentExpose) {
      keys.push(this.currentExpose.property);
    }
    if (this.energyExpose) {
      keys.push(this.energyExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state, this.log));
  }

  static generateIdentifier(endpoint: string | undefined): string {
    let identifier = ELECTRICAL_SERVICE_UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

export class ProducedEnergySensorHandler implements ServiceHandler {
  protected log: BasicLogger;
  protected monitors: CharacteristicMonitor[] = [];
  protected service: Service;
  protected serviceName: string;
  identifier = '';

  private static readonly SUBTYPE = 'produced';
  private producedEnergyExpose: ExposesEntryWithProperty;

  constructor(accessory: BasicAccessory, producedEnergyExpose: ExposesEntryWithProperty, endpoint: string | undefined) {
    this.log = accessory.log;
    this.producedEnergyExpose = producedEnergyExpose;

    const subType = endpoint !== undefined ? `${endpoint} ${ProducedEnergySensorHandler.SUBTYPE}` : ProducedEnergySensorHandler.SUBTYPE;
    this.serviceName = accessory.getDefaultServiceDisplayName(subType);
    this.identifier = ProducedEnergySensorHandler.generateIdentifier(endpoint);

    this.service = accessory.getOrAddService(createElectricalSensorService(this.serviceName, subType));

    accessory.log.debug(`Configuring ProducedEnergySensor for ${this.serviceName}`);

    // Add kWh characteristic for produced energy
    this.service.addCharacteristic(createProducedKilowattHourCharacteristic());
    this.monitors.push(new PassthroughCharacteristicMonitor(producedEnergyExpose.property, this.service, CHARACTERISTIC_PRODUCED_KWH_NAME));
  }

  get mainCharacteristics(): (Characteristic | undefined)[] {
    return [this.service.getCharacteristic(CHARACTERISTIC_PRODUCED_KWH_NAME)];
  }

  get getableKeys(): string[] {
    return [this.producedEnergyExpose.property];
  }

  updateState(state: Record<string, unknown>): void {
    this.monitors.forEach((m) => m.callback(state, this.log));
  }

  static generateIdentifier(endpoint: string | undefined): string {
    let identifier = `${ProducedEnergySensorHandler.SUBTYPE}_${ELECTRICAL_SERVICE_UUID}`;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

export class ElectricalSensorCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    // Filter for numeric electrical exposes
    const electricalExposes = exposes
      .filter(
        (e) =>
          exposesHasProperty(e) && exposesIsPublished(e) && e.type === ExposesKnownTypes.NUMERIC && ALL_ELECTRICAL_NAMES.includes(e.name)
      )
      .map((e) => e as ExposesEntryWithProperty);

    if (electricalExposes.length === 0) {
      return;
    }

    // Group by endpoint
    const endpointMap = groupByEndpoint(electricalExposes);

    endpointMap.forEach((endpointExposes, endpoint) => {
      // Find exposes for consumed electrical properties (power, voltage, current, energy)
      const electricalData: ElectricalExposes = {
        power: findExpose(endpointExposes, POWER_NAMES),
        voltage: findExpose(endpointExposes, VOLTAGE_NAMES),
        current: findExpose(endpointExposes, CURRENT_NAMES),
        energy: findExpose(endpointExposes, ENERGY_CONSUMED_NAMES),
      };

      // Create consumed energy sensor if we have any electrical properties
      const hasAnyElectricalProperty =
        electricalData.power !== undefined ||
        electricalData.voltage !== undefined ||
        electricalData.current !== undefined ||
        electricalData.energy !== undefined;

      if (hasAnyElectricalProperty && !accessory.isServiceHandlerIdKnown(ElectricalSensorHandler.generateIdentifier(endpoint))) {
        this.createElectricalSensorHandler(accessory, electricalData, endpoint);
      }

      // Find and create produced energy sensor separately
      const producedEnergyExpose = findExpose(endpointExposes, ENERGY_PRODUCED_NAMES);

      if (
        producedEnergyExpose !== undefined &&
        !accessory.isServiceHandlerIdKnown(ProducedEnergySensorHandler.generateIdentifier(endpoint))
      ) {
        this.createProducedEnergySensorHandler(accessory, producedEnergyExpose, endpoint);
      }
    });
  }

  private createElectricalSensorHandler(
    accessory: BasicAccessory,
    electricalExposes: ElectricalExposes,
    endpoint: string | undefined
  ): void {
    try {
      const handler = new ElectricalSensorHandler(accessory, electricalExposes, endpoint);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup electrical sensor for accessory ${accessory.displayName} on endpoint "${endpoint}": ${error}`);
    }
  }

  private createProducedEnergySensorHandler(
    accessory: BasicAccessory,
    producedEnergyExpose: ExposesEntryWithProperty,
    endpoint: string | undefined
  ): void {
    try {
      const handler = new ProducedEnergySensorHandler(accessory, producedEnergyExpose, endpoint);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(
        `Failed to setup produced energy sensor for accessory ${accessory.displayName} on endpoint "${endpoint}": ${error}`
      );
    }
  }
}
