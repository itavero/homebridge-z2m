import { API } from 'homebridge';
import { setHap } from './hap';
import { Zigbee2mqttPlatform } from './platform';
import { PLATFORM_NAME } from './settings';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  setHap(api.hap);
  api.registerPlatform(PLATFORM_NAME, Zigbee2mqttPlatform);
};
