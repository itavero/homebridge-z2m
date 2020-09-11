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
}