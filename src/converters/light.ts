import { BasicAccessory, ServiceCreator, ServiceHandler, ConverterConfigurationRegistry } from './interfaces';
import {
  exposesCanBeGet,
  exposesCanBeSet,
  ExposesEntry,
  ExposesEntryWithBinaryProperty,
  ExposesEntryWithFeatures,
  ExposesEntryWithNumericRangeProperty,
  ExposesEntryWithProperty,
  exposesHasAllRequiredFeatures,
  exposesHasBinaryProperty,
  exposesHasFeatures,
  exposesHasNumericRangeProperty,
  exposesHasProperty,
  exposesIsPublished,
  ExposesKnownTypes,
  ExposesPredicate,
} from '../z2mModels';
import { hap } from '../hap';
import { getOrAddCharacteristic } from '../helpers';
import { Characteristic, CharacteristicSetCallback, CharacteristicValue, Controller, Service } from 'homebridge';
import {
  CharacteristicMonitor,
  MappingCharacteristicMonitor,
  NestedCharacteristicMonitor,
  NumericCharacteristicMonitor,
  PassthroughCharacteristicMonitor,
} from './monitor';
import { convertHueSatToXy, convertMiredColorTemperatureToHueSat, convertXyToHueSat } from '../colorhelper';
import { EXP_COLOR_MODE } from '../experimental';

interface LightConfig {
  adaptive_lighting?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isLightConfig = (x: any): x is LightConfig =>
  x !== undefined && (x.adaptive_lighting === undefined || typeof x.adaptive_lighting === 'boolean');

export class LightCreator implements ServiceCreator {
  public static readonly CONFIG_TAG = 'light';

  constructor(converterConfigRegistry: ConverterConfigurationRegistry) {
    converterConfigRegistry.registerConverterConfiguration(LightCreator.CONFIG_TAG, LightCreator.isValidConverterConfiguration);
  }

  createServicesFromExposes(accessory: BasicAccessory, exposes: ExposesEntry[]): void {
    exposes
      .filter(
        (e) =>
          e.type === ExposesKnownTypes.LIGHT &&
          exposesHasFeatures(e) &&
          exposesHasAllRequiredFeatures(e, [LightHandler.PREDICATE_STATE]) &&
          !accessory.isServiceHandlerIdKnown(LightHandler.generateIdentifier(e.endpoint))
      )
      .forEach((e) => this.createService(e as ExposesEntryWithFeatures, accessory));
  }

  private createService(expose: ExposesEntryWithFeatures, accessory: BasicAccessory): void {
    const converterConfig = accessory.getConverterConfiguration(LightCreator.CONFIG_TAG);
    let adaptiveLightingEnabled = false;
    if (isLightConfig(converterConfig) && converterConfig.adaptive_lighting) {
      adaptiveLightingEnabled = true;
    }

    try {
      const handler = new LightHandler(expose, accessory, adaptiveLightingEnabled);
      accessory.registerServiceHandler(handler);
    } catch (error) {
      accessory.log.warn(`Failed to setup light for accessory ${accessory.displayName} from expose "${JSON.stringify(expose)}": ${error}`);
    }
  }

  private static isValidConverterConfiguration(config: unknown): boolean {
    return isLightConfig(config);
  }
}

interface AdaptiveLightingControl extends Controller {
  isAdaptiveLightingActive(): boolean;
  disableAdaptiveLighting(): void;
}

class LightHandler implements ServiceHandler {
  public static readonly PREDICATE_STATE: ExposesPredicate = (e) =>
    e.name === 'state' && exposesIsPublished(e) && exposesCanBeSet(e) && exposesHasBinaryProperty(e);

  public static readonly KEY_COLOR_MODE = 'color_mode';
  public static readonly COLOR_MODE_TEMPERATURE = 'color_temp';

  public mainCharacteristics: Characteristic[];

  private monitors: CharacteristicMonitor[] = [];
  private stateExpose: ExposesEntryWithBinaryProperty;
  private brightnessExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private colorTempExpose: ExposesEntryWithNumericRangeProperty | undefined;
  private colorExpose: ExposesEntryWithFeatures | undefined;
  private colorComponentAExpose: ExposesEntryWithProperty | undefined;
  private colorComponentBExpose: ExposesEntryWithProperty | undefined;

  // Adaptive lighting
  private adaptiveLighting: AdaptiveLightingControl | undefined;
  private lastAdaptiveLightingTemperature: number | undefined;
  private colorHueCharacteristic: Characteristic | undefined;
  private colorSaturationCharacteristic: Characteristic | undefined;

  // Internal cache for hue and saturation. Needed in case X/Y is used
  private cached_hue = 0.0;
  private received_hue = false;
  private cached_saturation = 0.0;
  private received_saturation = false;

  constructor(
    expose: ExposesEntryWithFeatures,
    private readonly accessory: BasicAccessory,
    private readonly adaptiveLightingEnabled: boolean
  ) {
    const endpoint = expose.endpoint;
    this.identifier = LightHandler.generateIdentifier(endpoint);

    const features = expose.features.filter((e) => exposesHasProperty(e)).map((e) => e as ExposesEntryWithProperty);

    // On/off characteristic (required by HomeKit)
    const potentialStateExpose = features.find((e) => LightHandler.PREDICATE_STATE(e));
    if (potentialStateExpose === undefined) {
      throw new Error('Required "state" property not found for Light.');
    }
    this.stateExpose = potentialStateExpose as ExposesEntryWithBinaryProperty;

    const serviceName = accessory.getDefaultServiceDisplayName(endpoint);

    accessory.log.debug(`Configuring Light for ${serviceName}`);
    const service = accessory.getOrAddService(new hap.Service.Lightbulb(serviceName, endpoint));

    this.mainCharacteristics = [getOrAddCharacteristic(service, hap.Characteristic.On).on('set', this.handleSetOn.bind(this))];
    const onOffValues = new Map<CharacteristicValue, CharacteristicValue>();
    onOffValues.set(this.stateExpose.value_on, true);
    onOffValues.set(this.stateExpose.value_off, false);
    this.monitors.push(new MappingCharacteristicMonitor(this.stateExpose.property, service, hap.Characteristic.On, onOffValues));

    // Brightness characteristic
    this.tryCreateBrightness(features, service);

    // Color: Hue/Saturation or X/Y
    this.tryCreateColor(expose, service);

    // Color temperature
    this.tryCreateColorTemperature(features, service);

    // Adaptive lighting
    this.tryCreateAdaptiveLighting(service);
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
    if (
      this.colorExpose !== undefined &&
      this.colorExpose.property !== undefined &&
      ((this.colorComponentAExpose !== undefined && exposesCanBeGet(this.colorComponentAExpose)) ||
        (this.colorComponentBExpose !== undefined && exposesCanBeGet(this.colorComponentBExpose)))
    ) {
      keys.push(this.colorExpose.property);
    }
    return keys;
  }

  updateState(state: Record<string, unknown>): void {
    if (LightHandler.KEY_COLOR_MODE in state) {
      const colorModeIsTemperature: boolean = state[LightHandler.KEY_COLOR_MODE] === LightHandler.COLOR_MODE_TEMPERATURE;
      // If adaptive lighting is enabled, try to detect if the color was changed externally
      // which should result in turning off adaptive lighting.
      this.disableAdaptiveLightingBasedOnState(colorModeIsTemperature, state);

      // Use color_mode to filter out the non-active color information
      // to prevent "incorrect" updates (leading to "glitches" in the Home.app)
      if (this.accessory.isExperimentalFeatureEnabled(EXP_COLOR_MODE)) {
        if (this.colorTempExpose !== undefined && this.colorTempExpose.property in state && !colorModeIsTemperature) {
          // Color mode is NOT Color Temperature. Remove color temperature information.
          delete state[this.colorTempExpose.property];
        }

        if (
          this.colorExpose !== undefined &&
          this.colorExpose.property !== undefined &&
          this.colorExpose.property in state &&
          colorModeIsTemperature
        ) {
          // Color mode is Color Temperature. Remove HS/XY color information.
          delete state[this.colorExpose.property];
        }
      }
    }

    this.monitors.forEach((m) => m.callback(state));
  }

  private disableAdaptiveLightingBasedOnState(colorModeIsTemperature: boolean, state: Record<string, unknown>) {
    if (this.colorTempExpose !== undefined && this.adaptiveLighting !== undefined && this.adaptiveLighting.isAdaptiveLightingActive()) {
      if (!colorModeIsTemperature) {
        // Must be color temperature if adaptive lighting is active
        this.accessory.log.debug('adaptive_lighting: disable due to color mode change');
        this.adaptiveLighting.disableAdaptiveLighting();
      } else if (this.lastAdaptiveLightingTemperature !== undefined && this.colorTempExpose.property in state) {
        const delta = Math.abs(this.lastAdaptiveLightingTemperature - (state[this.colorTempExpose.property] as number));
        // Typically we expect a small delta if the status update is caused by a change from adaptive lighting.
        if (delta > 10) {
          this.accessory.log.debug(`adaptive_lighting: disable due to large delta (${delta})`);
          this.adaptiveLighting.disableAdaptiveLighting();
        }
      }
    }
  }

  private tryCreateColor(expose: ExposesEntryWithFeatures, service: Service) {
    // First see if color_hs is present
    this.colorExpose = expose.features.find(
      (e) => exposesHasFeatures(e) && e.type === ExposesKnownTypes.COMPOSITE && e.name === 'color_hs' && e.property !== undefined
    ) as ExposesEntryWithFeatures | undefined;

    // Otherwise check for color_xy
    if (this.colorExpose === undefined) {
      this.colorExpose = expose.features.find(
        (e) => exposesHasFeatures(e) && e.type === ExposesKnownTypes.COMPOSITE && e.name === 'color_xy' && e.property !== undefined
      ) as ExposesEntryWithFeatures | undefined;
    }

    if (this.colorExpose !== undefined && this.colorExpose.property !== undefined) {
      // Note: Components of color_xy and color_hs do not specify a range in zigbee-herdsman-converters
      const components = this.colorExpose.features
        .filter((e) => exposesHasProperty(e) && e.type === ExposesKnownTypes.NUMERIC)
        .map((e) => e as ExposesEntryWithProperty);

      this.colorComponentAExpose = undefined;
      this.colorComponentBExpose = undefined;
      if (this.colorExpose.name === 'color_hs') {
        this.colorComponentAExpose = components.find((e) => e.name === 'hue');
        this.colorComponentBExpose = components.find((e) => e.name === 'saturation');
      } else if (this.colorExpose.name === 'color_xy') {
        this.colorComponentAExpose = components.find((e) => e.name === 'x');
        this.colorComponentBExpose = components.find((e) => e.name === 'y');
      }
      if (this.colorComponentAExpose === undefined || this.colorComponentBExpose === undefined) {
        // Can't create service if not all components are present.
        this.colorExpose = undefined;
        return;
      }

      this.colorHueCharacteristic = getOrAddCharacteristic(service, hap.Characteristic.Hue).on('set', this.handleSetHue.bind(this));
      this.colorSaturationCharacteristic = getOrAddCharacteristic(service, hap.Characteristic.Saturation).on(
        'set',
        this.handleSetSaturation.bind(this)
      );

      if (this.colorExpose.name === 'color_hs') {
        this.monitors.push(
          new NestedCharacteristicMonitor(this.colorExpose.property, [
            new PassthroughCharacteristicMonitor(this.colorComponentAExpose.property, service, hap.Characteristic.Hue),
            new PassthroughCharacteristicMonitor(this.colorComponentBExpose.property, service, hap.Characteristic.Saturation),
          ])
        );
      } else if (this.colorExpose.name === 'color_xy') {
        this.monitors.push(
          new ColorXyCharacteristicMonitor(
            service,
            this.colorExpose.property,
            this.colorComponentAExpose.property,
            this.colorComponentBExpose.property
          )
        );
      }
    }
  }

  private tryCreateColorTemperature(features: ExposesEntryWithProperty[], service: Service) {
    this.colorTempExpose = features.find(
      (e) => e.name === 'color_temp' && exposesHasNumericRangeProperty(e) && exposesCanBeSet(e) && exposesIsPublished(e)
    ) as ExposesEntryWithNumericRangeProperty;
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

      this.monitors.push(new PassthroughCharacteristicMonitor(this.colorTempExpose.property, service, hap.Characteristic.ColorTemperature));

      // Also supports colors?
      if (
        this.accessory.isExperimentalFeatureEnabled(EXP_COLOR_MODE) &&
        this.colorTempExpose !== undefined &&
        this.colorExpose !== undefined
      ) {
        // Add monitor to convert Color Temperature to Hue / Saturation
        // based on the 'color_mode'
        this.monitors.push(new ColorTemperatureToHueSatMonitor(service, this.colorTempExpose.property));
      }
    }
  }

  private tryCreateBrightness(features: ExposesEntryWithProperty[], service: Service) {
    this.brightnessExpose = features.find(
      (e) => e.name === 'brightness' && exposesHasNumericRangeProperty(e) && exposesCanBeSet(e) && exposesIsPublished(e)
    ) as ExposesEntryWithNumericRangeProperty;
    if (this.brightnessExpose !== undefined) {
      this.mainCharacteristics.push(
        getOrAddCharacteristic(service, hap.Characteristic.Brightness).on('set', this.handleSetBrightness.bind(this))
      );
      this.monitors.push(
        new NumericCharacteristicMonitor(
          this.brightnessExpose.property,
          service,
          hap.Characteristic.Brightness,
          this.brightnessExpose.value_min,
          this.brightnessExpose.value_max
        )
      );
    }
  }

  private tryCreateAdaptiveLighting(service: Service) {
    // Adaptive lighting is not enabled
    if (!this.adaptiveLightingEnabled) {
      return;
    }

    // Need at least brightness and color temperature to add Adaptive Lighting
    if (this.brightnessExpose === undefined || this.colorTempExpose === undefined) {
      return;
    }

    this.adaptiveLighting = new hap.AdaptiveLightingController(service).on('disable', this.resetAdaptiveLightingTemperature.bind(this));
    this.accessory.configureController(this.adaptiveLighting);
  }

  private resetAdaptiveLightingTemperature(): void {
    this.lastAdaptiveLightingTemperature = undefined;
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
        data[this.brightnessExpose.property] = Math.round(
          this.brightnessExpose.value_min + ((value as number) / 100) * (this.brightnessExpose.value_max - this.brightnessExpose.value_min)
        );
      }
      this.accessory.queueDataForSetAction(data);
      callback(null);
    } else {
      callback(new Error('brightness not supported'));
    }
  }

  private handleSetColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (this.colorTempExpose !== undefined && typeof value === 'number') {
      const data = {};
      if (value < this.colorTempExpose.value_min) {
        value = this.colorTempExpose.value_min;
      }

      if (value > this.colorTempExpose.value_max) {
        value = this.colorTempExpose.value_max;
      }

      data[this.colorTempExpose.property] = value;

      if (this.handleAdaptiveLighting(value)) {
        this.accessory.queueDataForSetAction(data);
      }

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
        if (this.adaptiveLighting?.isAdaptiveLightingActive()) {
          // Hue/Saturation set from HomeKit, disable Adaptive Lighting
          this.accessory.log.debug('adaptive_lighting: disable due to hue/sat');
          this.adaptiveLighting.disableAdaptiveLighting();
        }
        if (
          this.colorExpose?.name === 'color_hs' &&
          this.colorExpose?.property !== undefined &&
          this.colorComponentAExpose !== undefined &&
          this.colorComponentBExpose !== undefined
        ) {
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
        if (this.adaptiveLighting?.isAdaptiveLightingActive()) {
          // Hue/Saturation set from HomeKit, disable Adaptive Lighting
          this.accessory.log.debug('adaptive_lighting: disable due to hue/sat');
          this.adaptiveLighting.disableAdaptiveLighting();
        }
        if (
          this.colorExpose?.name === 'color_xy' &&
          this.colorExpose?.property !== undefined &&
          this.colorComponentAExpose !== undefined &&
          this.colorComponentBExpose !== undefined
        ) {
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

  private handleAdaptiveLighting(value: number): boolean {
    // Adaptive Lighting active?
    if (this.colorTempExpose !== undefined && this.adaptiveLighting !== undefined && this.adaptiveLighting.isAdaptiveLightingActive()) {
      if (this.lastAdaptiveLightingTemperature === undefined) {
        this.lastAdaptiveLightingTemperature = value;
      } else {
        const change = Math.abs(this.lastAdaptiveLightingTemperature - value);
        if (change < 1) {
          this.accessory.log.debug(
            `adaptive_lighting: ${this.accessory.displayName}: skipped ${this.colorTempExpose.property} (new: ${value}; ` +
              `old: ${this.lastAdaptiveLightingTemperature}`
          );
          return false;
        }

        this.accessory.log.debug(`adaptive_lighting: ${this.accessory.displayName}: ${this.colorTempExpose.property} ${value}`);
        this.lastAdaptiveLightingTemperature = value;
      }
    } else {
      this.resetAdaptiveLightingTemperature();
    }

    return true;
  }

  private updateHueAndSaturationBasedOnColorTemperature(value: number): void {
    if (this.colorHueCharacteristic !== undefined && this.colorSaturationCharacteristic !== undefined) {
      const color = hap.ColorUtils.colorTemperatureToHueAndSaturation(value, true);
      this.colorHueCharacteristic.updateValue(color.hue);
      this.colorSaturationCharacteristic.updateValue(color.saturation);
    }
  }
}

class ColorTemperatureToHueSatMonitor implements CharacteristicMonitor {
  constructor(private readonly service: Service, private readonly key_temp: string) {}

  callback(state: Record<string, unknown>): void {
    if (
      this.key_temp in state &&
      LightHandler.KEY_COLOR_MODE in state &&
      state[LightHandler.KEY_COLOR_MODE] === LightHandler.COLOR_MODE_TEMPERATURE
    ) {
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
    private readonly key_y: string
  ) {}

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
