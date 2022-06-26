import { BasicAccessory } from '../interfaces';
import { ExposesEntryWithBinaryProperty, ExposesEntryWithProperty } from '../../z2mModels';
import { PassthroughCharacteristicMonitor } from '../monitor';
import { Characteristic, Service } from 'homebridge';
import { hap } from '../../hap';
import { BasicSensorHandler } from './basic';

export class AirPressureSensorHandler extends BasicSensorHandler {
  private static readonly ServiceUUID: string = 'E863F00A-079E-48FF-8F27-9C2605A29F52';
  private static readonly CharacteristicUUID: string = 'E863F10F-079E-48FF-8F27-9C2605A29F52';
  private static readonly CharacteristicName: string = 'Air Pressure';

  static AirPressureSensor(displayName: string, subtype?: string | undefined): Service {
    const service = new hap.Service(displayName, AirPressureSensorHandler.ServiceUUID, subtype);
    service.addCharacteristic(AirPressureSensorHandler.AirPressure);
    return service;
  }

  static get AirPressure(): Characteristic {
    const characteristic = new hap.Characteristic(AirPressureSensorHandler.CharacteristicName, AirPressureSensorHandler.CharacteristicUUID,
      {
        format: hap.Formats.UINT16,
        perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
        minValue: 700,
        maxValue: 1100,
        minStep: 1,
      });
    characteristic.value = 1013;
    return characteristic;
  }

  constructor(expose: ExposesEntryWithProperty, allExposes: ExposesEntryWithBinaryProperty[], accessory: BasicAccessory) {
    super(accessory, expose, allExposes, AirPressureSensorHandler.generateIdentifier,
      (n, t) => AirPressureSensorHandler.AirPressureSensor(n, t));
    accessory.log.debug(`Configuring AirPressureSensor for ${this.serviceName}`);

    this.monitors.push(new PassthroughCharacteristicMonitor(expose.property, this.service, AirPressureSensorHandler.CharacteristicName));
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = AirPressureSensorHandler.ServiceUUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}