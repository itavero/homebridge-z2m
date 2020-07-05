import { Service, Characteristic, Formats, Perms } from 'hap-nodejs';

export class CustomServices {
   static AirPressureSensor: typeof AirPressureSensor;
}

export class CustomCharacteristics {
   static AirPressure: typeof AirPressure;
}

export class AirPressureSensor extends Service {
   static readonly UUID: string = 'E863F00A-079E-48FF-8F27-9C2605A29F52';
   constructor(displayName: string, subtype: string) {
     super(displayName, AirPressureSensor.UUID, subtype);

     this.addCharacteristic(CustomCharacteristics.AirPressure);
   }
}
CustomServices.AirPressureSensor = AirPressureSensor;

export class AirPressure extends Characteristic {
   static readonly UUID: string = 'E863F10F-079E-48FF-8F27-9C2605A29F52';

   constructor() {
     super('Air Pressure', AirPressure.UUID);
     this.setProps({
       format: Formats.UINT16,
       perms: [Perms.PAIRED_READ, Perms.NOTIFY],
       minValue: 700,
       maxValue: 1100,
       minStep: 1,
     });
     this.value = this.getDefaultValue();
   }
}
CustomCharacteristics.AirPressure = AirPressure;