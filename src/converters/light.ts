import { BasicAccessory, ServiceCreator, ServiceHandler } from './interfaces';
import {
  exposesCanBeGet, exposesCanBeSet, ExposesEntry, ExposesEntryWithBinaryProperty, ExposesEntryWithFeatures,
  ExposesEntryWithNumericRangeProperty,
  ExposesEntryWithProperty, exposesHasBinaryProperty, exposesHasFeatures,
  exposesHasNumericRangeProperty,
  exposesHasProperty, exposesIsPublished, ExposesKnownTypes,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { CharacteristicSetCallback, CharacteristicValue, Service } from 'homebridge';
import {
  CharacteristicMonitor, MappingCharacteristicMonitor, NestedCharacteristicMonitor, NumericCharacteristicMonitor,
  PassthroughCharacteristicMonitor,
} from './monitor';
import { convertHueSatToXy, convertMiredColorTemperatureToHueSat, convertXyToHueSat } from '../colorhelper';

export class LightCreator implements ServiceCreator {
  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes.filter(e => e.type === ExposesKnownTypes.LIGHT && exposesHasFeatures(e)
      && !accessory.isServiceHandlerIdKnown(LightHandler.generateIdentifier(e.endpoint)))
      .forEach(e => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    try {
      const handler = new LightHandler(expose, accessory);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup light for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }
}

class LightHandler implements ServiceHandler {
  public static readonly KEY_COLOR_MODE = 'color_mode';
  public static readonly COLOR_MODE_TEMPERATURE = 'color_temp';

  private monitors: CharacteristicMonitor[] = [];
  private stateExpose: ExposesEntryWithBinaryProperty;
  private brightnessExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private colorTempExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private colorExpose: ExposesEntryWithFeatures | undefined;
  private colorComponentAExpose: ExposesEntryWithProperty | undefined;
  private colorComponentBExpose: ExposesEntryWithProperty | undefined;

  // Internal cache for hue and saturation. Needed in case X/Y is used
  private cached_hue = 0.0;
  private received_hue = false;
  private cached_saturation = 0.0;
  private received_saturation = false;

  constructor(expose: ExposesEntryWithFeatures, private readonly accessory: BasicAccessory) {
    const endpoint = expose.endpoint;
    this.identifier = LightHandler.generateIdentifier(endpoint);

    const features = expose.features.filter(e => exposesHasProperty(e) && !accessory.isPropertyExcluded(e.property))
      .map(e => e as ExposesEntryWithProperty);

    // On/off characteristic (required by HomeKit)
    const potentialStateExpose = features.find(e => e.name === 'state' && exposesIsPublished(e) && exposesCanBeSet(e));
    if (potentialStateExpose === undefined || !exposesHasBinaryProperty(potentialStateExpose)) {
      throw new Error('Required "state" property not found for Light.');
    }
    this.stateExpose = potentialStateExpose;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring Light for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.Lightbulb(serviceName, endpoint));

    getOrAddCharacteristic(service, hap.Characteristic.On).on('set', this.handleSetOn.bind(this));
    const onOffValues = new Map<CharacteristicValue, CharacteristicValue>();
    onOffValues.set(this.stateExpose.value_on, true);
    onOffValues.set(this.stateExpose.value_off, false);
    this.monitors.push(new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.On,
      onOffValues));

    // Brightness characteristic
    this.tryCreateBrightness(features, service);

    // Color temperature
    this.tryCreateColorTemperature(features, service);

    // Color: Hue/Saturation or X/Y
    this.tryCreateColor(expose, service, accessory);

    // Both temperature and color?
    if (this.colorTempExpose !== undefined && this.colorExpose !== undefined) {
      // Add monitor to convert Color Temperature to Hue / Saturation
      // based on the 'color_mode'
      this.monitors.push(new ColorTemperatureToHueSatMonitor(service, this.colorTempExpose.property));
    }
  }

  identifier: string;
  get getableKeys(): string[] {
    const keys: string[] = [];
    if (exposesCanBeGet(this.stateExpose)) {
      keys.push(this.stateExpose.property);
    }
    if (this.brightnessExpose !== undefined && exposesCanBeGet(this.brightnessExpose)) {
      keys.push(this.brightnessExpose.property);
    }
    if (this.colorTempExpose !== undefined && exposesCanBeGet(this.colorTempExpose)) {
      keys.push(this.colorTempExpose.property);
    }
    if (this.colorExpose !== undefined && this.colorExpose.property !== undefined) {
      if ((this.colorComponentAExpose !== undefined && exposesCanBeGet(this.colorComponentAExpose))
        || (this.colorComponentBExpose !== undefined && exposesCanBeGet(this.colorComponentBExpose))
      ) {
        keys.push(this.colorExpose.property);
      }
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    // Use color_mode to filter out the non-active color information
    // to prevent "incorrect" updates (leading to "glitches" in the Home.app)
    if (LightHandler.KEY_COLOR_MODE in state) {
      if (this.colorTempExpose !== undefined
        && this.colorTempExpose.property in state
        && state[LightHandler.KEY_COLOR_MODE] !== LightHandler.COLOR_MODE_TEMPERATURE) {
        // Color mode is NOT Color Temperature. Remove color temperature information.
        delete state[this.colorTempExpose.property];
      }

      if (this.colorExpose !== undefined
        && this.colorExpose.property !== undefined
        && this.colorExpose.property in state
        && state[LightHandler.KEY_COLOR_MODE] === LightHandler.COLOR_MODE_TEMPERATURE) {
        // Color mode is Color Temperature. Remove HS/XY color information.
        delete state[this.colorExpose.property];
      }
    }

    this.monitors.forEach(m => m.callback(state));
  }

  private tryCreateColor(expose: ExposesEntryWithFeatures, service: Service, accessory: BasicAccessory) {
    // First see if color_hs is present
    this.colorExpose = expose.features.find(e => exposesHasFeatures(e)
      && e.type === ExposesKnownTypes.COMPOSITE && e.name === 'color_hs'
      && e.property !== undefined && !accessory.isPropertyExcluded(e.property)) as ExposesEntryWithFeatures | undefined;

    // Otherwise check for color_xy
    if (this.colorExpose === undefined) {
      this.colorExpose = expose.features.find(e => exposesHasFeatures(e)
        && e.type === ExposesKnownTypes.COMPOSITE && e.name === 'color_xy'
        && e.property !== undefined && !accessory.isPropertyExcluded(e.property)) as ExposesEntryWithFeatures | undefined;
    }

    if (this.colorExpose !== undefined && this.colorExpose.property !== undefined) {
      // Note: Components of color_xy and color_hs do not specify a range in zigbee-herdsman-converters
      const components = this.colorExpose.features.filter(e => exposesHasProperty(e) && e.type === ExposesKnownTypes.NUMERIC)
        .map(e => e as ExposesEntryWithProperty);

      this.colorComponentAExpose = undefined;
      this.colorComponentBExpose = undefined;
      if (this.colorExpose.name === 'color_hs') {
        this.colorComponentAExpose = components.find(e => e.name === 'hue');
        this.colorComponentBExpose = components.find(e => e.name === 'saturation');
      } else if (this.colorExpose.name === 'color_xy') {
        this.colorComponentAExpose = components.find(e => e.name === 'x');
        this.colorComponentBExpose = components.find(e => e.name === 'y');
      }
      if (this.colorComponentAExpose === undefined || this.colorComponentBExpose === undefined) {
        // Can't create service if not all components are present.
        this.colorExpose = undefined;
        return;
      }

      getOrAddCharacteristic(service, hap.Characteristic.Hue).on('set', this.handleSetHue.bind(this));
      getOrAddCharacteristic(service, hap.Characteristic.Saturation).on('set', this.handleSetSaturation.bind(this));

      if (this.colorExpose.name === 'color_hs') {
        this.monitors.push(
          new NestedCharacteristicMonitor(this.colorExpose.property, [
            new PassthroughCharacteristicMonitor(this.colorComponentAExpose.property, service, hap.Characteristic.Hue),
            new PassthroughCharacteristicMonitor(this.colorComponentBExpose.property, service, hap.Characteristic.Saturation),
          ]));
      } else if (this.colorExpose.name === 'color_xy') {
        this.monitors.push(new ColorXyCharacteristicMonitor(service, this.colorExpose.property,
          this.colorComponentAExpose.property, this.colorComponentBExpose.property));
      }
    }
  }

  private tryCreateColorTemperature(features: ExposesEntryWithProperty[], service: Service) {
    this.colorTempExpose = features.find(e => e.name === 'color_temp' && exposesHasNumericRangeProperty(e) && exposesCanBeSet(e)
      && exposesIsPublished(e)) as ExposesEntryWithNumericRangeProperty;
    if (this.colorTempExpose !== undefined) {
      const characteristic = getOrAddCharacteristic(service, hap.Characteristic.ColorTemperature);
      characteristic.setProps({
        minValue: this.colorTempExpose.value_min,
        maxValue: this.colorTempExpose.value_max,
        minStep: 1,
      });

      // Set default value
      characteristic.value = this.colorTempExpose.value_min;

      characteristic.on('set', this.handleSetColorTemperature.bind(this));
      this.monitors.push(new PassthroughCharacteristicMonitor(this.colorTempExpose.property, service,
        hap.Characteristic.ColorTemperature));
    }
  }

  private tryCreateBrightness(features: ExposesEntryWithProperty[], service: Service) {
    this.brightnessExpose = features.find(e => e.name === 'brightness' && exposesHasNumericRangeProperty(e) && exposesCanBeSet(e)
      && exposesIsPublished(e)) as ExposesEntryWithNumericRangeProperty;
    if (this.brightnessExpose !== undefined) {
      getOrAddCharacteristic(service, hap.Characteristic.Brightness).on('set', this.handleSetBrightness.bind(this));
      this.monitors.push(new NumericCharacteristicMonitor(this.brightnessExpose.property, service, hap.Characteristic.Brightness,
        this.brightnessExpose.value_min, this.brightnessExpose.value_max));
    }
  }

  private handleSetOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const data = {};
    data[this.stateExpose.property] = (value as boolean) ? this.stateExpose.value_on : this.stateExpose.value_off;
    this.accessory.queueDataForSetAction(data);
    callback(null);
  }

  private handleSetBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.brightnessExpose !== undefined) {
      const data = {};
      if (value <= 0) {
        data[this.brightnessExpose.property] = this.brightnessExpose.value_min;
      } else if (value >= 100) {
        data[this.brightnessExpose.property] = this.brightnessExpose.value_max;
      } else {
        data[this.brightnessExpose.property] = Math.round(this.brightnessExpose.value_min
          + (((value as number) / 100) * (this.brightnessExpose.value_max - this.brightnessExpose.value_min)));
      }
      this.accessory.queueDataForSetAction(data);
      callback(null);
    } else {
      callback(new Error('brightness not supported'));
    }
  }

  private handleSetColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.colorTempExpose !== undefined) {
      const data = {};
      if (this.colorTempExpose.value_min !== undefined && value < this.colorTempExpose.value_min) {
        value = this.colorTempExpose.value_min;
      }

      if (this.colorTempExpose.value_max !== undefined && value > this.colorTempExpose.value_max) {
        value = this.colorTempExpose.value_max;
      }
      data[this.colorTempExpose.property] = value;
      this.accessory.queueDataForSetAction(data);
      callback(null);
    } else {
      callback(new Error('color temperature not supported'));
    }
  }

  private handleSetHue(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.cached_hue = value as number;
    this.received_hue = true;
    if (this.colorExpose?.name === 'color_hs' && this.colorComponentAExpose !== undefined) {
      this.publishHueAndSaturation();
      callback(null);
    } else if (this.colorExpose?.name === 'color_xy') {
      this.convertAndPublishHueAndSaturationAsXY();
      callback(null);
    } else {
      callback(new Error('color not supported'));
    }
  }

  private handleSetSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.cached_saturation = value as number;
    this.received_saturation = true;
    if (this.colorExpose?.name === 'color_hs' && this.colorComponentBExpose !== undefined) {
      this.publishHueAndSaturation();
      callback(null);
    } else if (this.colorExpose?.name === 'color_xy') {
      this.convertAndPublishHueAndSaturationAsXY();
      callback(null);
    } else {
      callback(new Error('color not supported'));
    }
  }

  private publishHueAndSaturation() {
    try {
      if (this.received_hue && this.received_saturation) {
        this.received_hue = false;
        this.received_saturation = false;
        if (this.colorExpose?.name === 'color_hs'
          && this.colorExpose?.property !== undefined
          && this.colorComponentAExpose !== undefined
          && this.colorComponentBExpose !== undefined) {
          const data = {};
          data[this.colorExpose.property] = {};
          data[this.colorExpose.property][this.colorComponentAExpose.property] = this.cached_hue;
          data[this.colorExpose.property][this.colorComponentBExpose.property] = this.cached_saturation;
          this.accessory.queueDataForSetAction(data);
        }
      }
    } catch (error) {
      this.accessory.log.error(`Failed to handle hue/saturation update for ${this.accessory.displayName}: ${error}`);
    }
  }

  private convertAndPublishHueAndSaturationAsXY() {
    try {
      if (this.received_hue && this.received_saturation) {
        this.received_hue = false;
        this.received_saturation = false;
        if (this.colorExpose?.name === 'color_xy'
          && this.colorExpose?.property !== undefined
          && this.colorComponentAExpose !== undefined
          && this.colorComponentBExpose !== undefined) {
          const data = {};
          const xy = convertHueSatToXy(this.cached_hue, this.cached_saturation);
          data[this.colorExpose.property] = {};
          data[this.colorExpose.property][this.colorComponentAExpose.property] = xy[0];
          data[this.colorExpose.property][this.colorComponentBExpose.property] = xy[1];
          this.accessory.queueDataForSetAction(data);
        }
      }
    } catch (error) {
      this.accessory.log.error(`Failed to handle hue/saturation update for ${this.accessory.displayName}: ${error}`);
    }
  }

  static generateIdentifier(endpoint: string | undefined) {
    let identifier = hap.Service.Lightbulb.UUID;
    if (endpoint !== undefined) {
      identifier += '_' + endpoint.trim();
    }
    return identifier;
  }
}

class ColorTemperatureToHueSatMonitor implements CharacteristicMonitor {
  constructor(
    private readonly service: Service,
    private readonly key_temp: string,
  ) { }

  callback(state: Record<string, unknown>): void {
    if (this.key_temp in state
      && LightHandler.KEY_COLOR_MODE in state
      && state[LightHandler.KEY_COLOR_MODE] === LightHandler.COLOR_MODE_TEMPERATURE) {
      const temperature = state[this.key_temp] as number;
      const hueSat = convertMiredColorTemperatureToHueSat(temperature);
      this.service.updateCharacteristic(hap.Characteristic.Hue, hueSat[0]);
      this.service.updateCharacteristic(hap.Characteristic.Saturation, hueSat[1]);
    }
  }
}

class ColorXyCharacteristicMonitor implements CharacteristicMonitor {
  constructor(
    private readonly service: Service,
    private readonly key: string,
    private readonly key_x: string,
    private readonly key_y: string,
  ) { }

  callback(state: Record<string, unknown>): void {
    if (this.key in state) {
      const nested_state = state[this.key] as Record<string, unknown>;
      if (this.key_x in nested_state && this.key_y in nested_state) {
        const value_x = nested_state[this.key_x] as number;
        const value_y = nested_state[this.key_y] as number;

        const hueSat = convertXyToHueSat(value_x, value_y);
        this.service.updateCharacteristic(hap.Characteristic.Hue, hueSat[0]);
        this.service.updateCharacteristic(hap.Characteristic.Saturation, hueSat[1]);
      }
    }
  }
}