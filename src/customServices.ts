import { Service, Characteristic } from 'homebridge';

import { hap } from './hap';

export interface ServiceFactory {
   (displayName: string, subtype?: string | undefined): Service;
}

export abstract class CustomServices {
   static readonly AirPressureSensorUUID: string = 'E863F00A-079E-48FF-8F27-9C2605A29F52';

   static AirPressureSensor(displayName: string, subtype?: string | undefined): Service {
     const service = new hap.Service(displayName, CustomServices.AirPressureSensorUUID, subtype);
     service.addCharacteristic(CustomCharacteristics.AirPressure);
     return service;
   }
}

export abstract class CustomCharacteristics {
   static readonly AirPressureUUID: string = 'E863F10F-079E-48FF-8F27-9C2605A29F52';
   static readonly VoltageUUID: string = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
   static readonly CurrentUUID: string = 'E863F126-079E-48FF-8F27-9C2605A29F52';
   static readonly PowerUUID: string = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
   static readonly EnergyConsumptionUUID: string = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

   static get AirPressure(): Characteristic {
     const characteristic = new hap.Characteristic('Air Pressure', CustomCharacteristics.AirPressureUUID);
     characteristic.setProps({
       format: hap.Formats.UINT16,
       perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
       minValue: 700,
       maxValue: 1100,
       minStep: 1,
     });
     characteristic.value = characteristic.getDefaultValue();

     return characteristic;
   }

   static get Voltage(): Characteristic {
     const characteristic = new hap.Characteristic('Voltage', CustomCharacteristics.VoltageUUID);
     characteristic.setProps({
       format: hap.Formats.FLOAT,
       perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
       minValue: 0,
       maxValue: 300,
       // unit: Volt
     });
     characteristic.value = characteristic.getDefaultValue();

     return characteristic;
   }

   static get Current(): Characteristic {
     const characteristic = new hap.Characteristic('Current', CustomCharacteristics.CurrentUUID);
     characteristic.setProps({
       format: hap.Formats.FLOAT,
       perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
       minValue: 0,
       maxValue: 16,
       // unit: Amp
     });
     characteristic.value = characteristic.getDefaultValue();

     return characteristic;
   }

   static get Power(): Characteristic {
     const characteristic = new hap.Characteristic('Power', CustomCharacteristics.PowerUUID);
     characteristic.setProps({
       format: hap.Formats.FLOAT,
       perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
       minValue: 0,
       maxValue: 10000,
       // unit: Watt
     });
     characteristic.value = characteristic.getDefaultValue();

     return characteristic;
   }

   static get EnergyConsumption(): Characteristic {
     const characteristic = new hap.Characteristic('Energy Consumption', CustomCharacteristics.EnergyConsumptionUUID);
     characteristic.setProps({
       format: hap.Formats.FLOAT,
       perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
       // unit: kWh
     });
     characteristic.value = characteristic.getDefaultValue();

     return characteristic;
   }
}