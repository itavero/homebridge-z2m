/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable max-len */
import fs from 'fs';
import path from 'path';
import { Definition, Expose, definitions } from 'zigbee-herdsman-converters';
import { BasicServiceCreatorManager } from '../converters/creators';
import { DocsAccessory } from './docs_accessory';
import { ExposesEntry } from '../z2mModels';
import * as hapNodeJs from 'hap-nodejs';
import { setHap } from '../hap';
import { Service, WithUUID } from 'hap-nodejs';
import { version_herdsman_converters, version_zigbee2mqtt } from './versions';

const docs_base_path = path.join(__dirname, '..', '..', 'docs', 'devices');
const exposes_base_path = path.join(__dirname, '..', '..', 'exposes');
const test_exposes_base_path = path.join(__dirname, '..', '..', 'test', 'exposes');
setHap(hapNodeJs);

// Helper type for handling white label device definition
type ExtendedDeviceDefinition = Definition & {
  isWhiteLabel?: boolean;
  whiteLabelOf?: Definition;
  exposes: Expose[];
};

// Clean devices directory
for (const file of fs.readdirSync(docs_base_path, { withFileTypes: true })) {
  const p = path.join(docs_base_path, file.name);
  if (file.isDirectory()) {
    fs.rmSync(p, { recursive: true });
  } else if (file.isFile()) {
    fs.unlinkSync(p);
  }
}

// Clean exposes directory
if (fs.existsSync(exposes_base_path)) {
  for (const file of fs.readdirSync(exposes_base_path, { withFileTypes: true })) {
    const p = path.join(exposes_base_path, file.name);
    if (file.isDirectory()) {
      fs.rmSync(p, { recursive: true });
    } else if (file.isFile()) {
      fs.unlinkSync(p);
    }
  }
}

function normalizeName(model: string): string {
  const find = '[/ :\\(\\)\\.]+';
  const re = new RegExp(find, 'g');
  return model
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(re, '_')
    .replace(/_+$/, '')
    .toLocaleLowerCase();
}

function normalizeNameForAnchor(model: string): string {
  const find = '[/ :+\\(\\)\\.]+';
  const re = new RegExp(find, 'g');
  return model
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(re, '_')
    .replace(/_+$/, '')
    .toLocaleLowerCase();
}

function generateZigbee2MqttLink(device: ExtendedDeviceDefinition) {
  const find = '[/| |:]';
  const re = new RegExp(find, 'g');
  return 'https://www.zigbee2mqtt.io/devices/' + encodeURIComponent(device.model.replace(re, '_')) + '.html';
}

// Service names / links
class ServiceInfo {
  constructor(
    readonly serviceName: string,
    readonly page: string | undefined = undefined
  ) {}
}
const hiddenCharacteristics = new Set<string>([hapNodeJs.Characteristic.Name.UUID]);
const characteristicNameMapping = new Map<string, string>([['E863F10F-079E-48FF-8F27-9C2605A29F52', 'Air Pressure']]);

function makeClassNameHumanReadable(name: string): string {
  // Replace common abbreviations first
  name = name.replace('VOC', 'VolatileOrganicCompounds');
  name = name.replace('PM10', 'ParticulateMatter 10');
  name = name.replace('PM2_5', 'ParticulateMatter 2.5');
  return name.replace(/([A-Z])/g, ' $1').trim();
}

function addServiceMapping(service: WithUUID<{ new (): Service }>, page?: string): [string, ServiceInfo] {
  // Secretly also tries to add all the characteristics to the lookup table.
  try {
    const s = new service();
    for (const char of s.characteristics) {
      characteristicNameMapping.set(char.UUID, makeClassNameHumanReadable(char.constructor.name));
    }
    for (const char of s.optionalCharacteristics) {
      characteristicNameMapping.set(char.UUID, makeClassNameHumanReadable(char.constructor.name));
    }
  } catch (err) {
    // ignore
  }

  return [service.UUID, new ServiceInfo(makeClassNameHumanReadable(service.name), page)];
}

const sensorsDocs = 'sensors.md';

const serviceNameMapping = new Map<string, ServiceInfo>([
  addServiceMapping(hapNodeJs.Service.Lightbulb, 'light.md'),
  addServiceMapping(hapNodeJs.Service.StatelessProgrammableSwitch, 'action.md'),
  addServiceMapping(hapNodeJs.Service.WindowCovering, 'cover.md'),
  addServiceMapping(hapNodeJs.Service.BatteryService, 'battery.md'),
  addServiceMapping(hapNodeJs.Service.LockMechanism, 'lock.md'),
  addServiceMapping(hapNodeJs.Service.Switch, 'switch.md'),
  addServiceMapping(hapNodeJs.Service.Thermostat, 'climate.md'),
  addServiceMapping(hapNodeJs.Service.HumiditySensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.TemperatureSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.LightSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.ContactSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.SmokeSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.OccupancySensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.MotionSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.CarbonMonoxideSensor, sensorsDocs),
  addServiceMapping(hapNodeJs.Service.LeakSensor, sensorsDocs),
  ['E863F00A-079E-48FF-8F27-9C2605A29F52', new ServiceInfo('Air Pressure Sensor', sensorsDocs)],
  addServiceMapping(hapNodeJs.Service.AirQualitySensor, 'air_quality.md'),
  addServiceMapping(hapNodeJs.Service.CarbonDioxideSensor, sensorsDocs),
]);

// Controllers
class ControllerMapping {
  constructor(
    readonly displayName: string,
    readonly page: string
  ) {}
}
const controllerMapping = new Map<string, ControllerMapping>([
  ['AdaptiveLightingController', new ControllerMapping('Adaptive Lighting', 'light.md')],
]);

const servicesIgnoredForDeterminingSupport = new Set<string>([hapNodeJs.Service.BatteryService.UUID]);

const ignoredExposesNames = new Set<string>(['linkquality', 'battery', 'battery_low']);

let supportedDeviceCounter = 0;
let unsupportedDeviceCounter = 0;

function characteristicIdsToMarkdown(characteristics: string[]): string {
  if (characteristics.length === 0) {
    throw new Error('No characteristics for service!?');
  }

  const unknownCharacteristics = characteristics.filter((c) => !characteristicNameMapping.has(c));
  if (unknownCharacteristics.length > 0) {
    console.log(`Unknown characteristic IDs:\n${unknownCharacteristics.sort().join('\n')}`);
  }

  return characteristics
    .filter((id) => !hiddenCharacteristics.has(id))
    .map((id) => characteristicNameMapping.get(id) ?? '')
    .filter((n) => n.length > 0)
    .sort()
    .map((n) => `  * ${n}\n`)
    .join('');
}

function serviceInfoToMarkdown(info: Map<string, string[]>): string {
  if (info.size === 0) {
    throw new Error('Service info may not be empty.');
  }

  const entries = new Map<string, string>();
  for (const [serviceId, characteristics] of info) {
    const service = serviceNameMapping.get(serviceId);
    if (service === undefined) {
      throw new Error(`No service name mapping for service with UUID: ${serviceId}`);
    }
    let markdown = '* ';
    if (service.page) {
      markdown += `[${service.serviceName}](../../${service.page})`;
    } else {
      markdown += `${service.serviceName}`;
    }
    markdown += '\n';
    markdown += characteristicIdsToMarkdown(characteristics);

    entries.set(service.serviceName.toLowerCase(), markdown);
  }

  // Sort and join
  const sortedKeys = [...entries.keys()].sort();
  let result = '';
  for (const key of sortedKeys) {
    const entry = entries.get(key);
    if (entry) {
      result += entry;
    }
  }

  return result;
}

function generateDevicePage(basePath: string, device: ExtendedDeviceDefinition, services: Map<string, string[]>, controllers: string[]) {
  if (device.isWhiteLabel) {
    // Don't generate device page for white label products.
    return;
  }

  const directory = path.join(basePath, normalizeName(device.vendor));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const fileName = path.join(directory, `${normalizeName(device.model)}.md`);

  let devicePage = `---
title: "${device.vendor} ${device.model} Homebridge/HomeKit integration"
description: "Add HomeKit support to your ${device.vendor} ${device.model}, using Homebridge, Zigbee2MQTT and homebridge-z2m."
---
<!---
This file has been GENERATED using src/docgen/docgen.ts
DO NOT EDIT THIS FILE MANUALLY!
-->
# ${device.vendor} ${device.model}
> ${device.description}

`;

  let whiteLabelCount = 0;
  if (device.whiteLabel) {
    whiteLabelCount = device.whiteLabel.length;
    devicePage += `\n## White-label models\n${device.whiteLabel
      .map((d) => `* [${d.vendor}](../index.md#${normalizeNameForAnchor(d.vendor)}) ${d.model}`)
      .join('\n')}\n`;
  }

  if (services.size === 0) {
    unsupportedDeviceCounter += 1 + whiteLabelCount;
    console.log(`[UNSUPPORTED] ${device.vendor} ${device.model} does NOT expose any HomeKit services.`);
    const searchIssueUrl = 'https://github.com/itavero/homebridge-z2m/issues?q=' + encodeURIComponent(device.model);
    const deviceNameEncoded = encodeURIComponent(device.vendor + ' ' + device.model);
    const deviceJsonExposes = JSON.stringify(device.exposes, null, 2);
    const newIssueUrl =
      'https://github.com/itavero/homebridge-z2m/issues/new?assignees=&labels=enhancement&template=device_support.yml&title=%5BDevice%5D+' +
      deviceNameEncoded +
      '&model=' +
      deviceNameEncoded +
      '&exposes=' +
      encodeURIComponent(deviceJsonExposes);
    devicePage += `
# Unsupported

This device is currently *UNSUPPORTED*.
Want to have this device supported? Please check the [GitHub issue section](${searchIssueUrl}) to see if a request already exists for this device.
If it doesn't exist yet, you can [open a new request](${newIssueUrl}) by filling in the _Device support_ issue template.

## Exposes

This is the information provided by Zigbee2MQTT for this device:

\`\`\`json
${deviceJsonExposes}
\`\`\`

`;
  } else {
    // Should we consider this device to be supported?
    const isSupported = [...services.keys()].findIndex((s) => !servicesIgnoredForDeterminingSupport.has(s)) >= 0;
    const hasPropertiesThatAreNotIgnored = device.exposes.findIndex((e) => !ignoredExposesNames.has(e.name)) >= 0;
    if (isSupported || !hasPropertiesThatAreNotIgnored) {
      supportedDeviceCounter += 1 + whiteLabelCount;
    } else {
      unsupportedDeviceCounter += 1 + whiteLabelCount;
      console.log(`[UNSUPPORTED] ${device.vendor} ${device.model} only exposes "ignored" HomeKit services.`);
    }
    devicePage += `
# Services and characteristics
The following HomeKit Services and Characteristics are exposed by
${device.whiteLabel ? 'these devices' : `the ${device.vendor} ${device.model}`}

${serviceInfoToMarkdown(services)}
${controllersToMarkdownList(controllers)}
`;

    if (!isSupported && hasPropertiesThatAreNotIgnored) {
      // Also add exposes information for these devices
      devicePage += `
## Exposes

This is the information provided by Zigbee2MQTT for this device:

\`\`\`json
${JSON.stringify(device.exposes, null, 2)}
\`\`\`

`;
    }
  }

  // Add related links
  devicePage += `# Related
* [Other devices from ${device.vendor}](../index.md#${normalizeNameForAnchor(device.vendor)})
* [Zigbee2MQTT documentation for this device](${generateZigbee2MqttLink(device)})`;
  fs.writeFileSync(fileName, devicePage);
}

function controllersToMarkdownList(controllers: string[]) {
  let result = '';
  if (controllers.length > 0) {
    result += '## Other features\n';
    for (const controller of controllers) {
      const mapping = controllerMapping.get(controller);
      if (mapping === undefined) {
        result += `* ${controller}\n`;
      } else {
        result += `* [${mapping.displayName}](../../${mapping.page})\n`;
      }
    }
  }
  return result;
}

function generateExposesJson(basePath: string, device: ExtendedDeviceDefinition) {
  if (device.isWhiteLabel) {
    // Don't generate device page for white label products.
    return;
  }
  const directory = path.join(basePath, normalizeName(device.vendor));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const fileName = path.join(directory, `${normalizeName(device.model)}.json`);

  try {
    fs.writeFileSync(fileName, JSON.stringify(device.exposes, null, 2));
  } catch (err) {
    console.log(`Problem writing ${fileName}: ${err}`);
  }
}

//////////
const allDevices: ExtendedDeviceDefinition[] = [
  ...definitions
    .filter((d) => typeof d.exposes === 'function' || d.exposes?.find((e) => e.name !== 'linkquality') !== undefined)
    .map((d) => {
      if (typeof d.exposes === 'function') {
        // Call function to generate array of exposes information.
        console.log(`Generating exposes array for ${d.vendor} ${d.model}`);
        d.exposes = d.exposes(undefined, undefined);
      }
      return d as ExtendedDeviceDefinition;
    }),
];

for (const definition of allDevices) {
  if (definition.whiteLabel) {
    for (const whiteLabel of definition.whiteLabel) {
      const whiteLabelDefinition = {
        ...definition,
        model: whiteLabel.model,
        vendor: whiteLabel.vendor,
        description: whiteLabel.description ?? definition.description,
        isWhiteLabel: true,
        whiteLabelOf: definition,
      };

      delete whiteLabelDefinition.whiteLabel;

      allDevices.push(whiteLabelDefinition);
    }
  }
}

// Check services for all non white label devices
function checkServicesAndCharacteristics(device: ExtendedDeviceDefinition): DocsAccessory {
  const exposes = device.exposes.map((e) => e as ExposesEntry);
  const accessory = new DocsAccessory(`${device.vendor} ${device.model}`);
  BasicServiceCreatorManager.getInstance().createHomeKitEntitiesFromExposes(accessory, exposes);
  return accessory;
}

allDevices.forEach((d) => {
  try {
    if (d.isWhiteLabel !== true) {
      generateExposesJson(exposes_base_path, d);
      const accessory = checkServicesAndCharacteristics(d);
      const services = accessory.getServicesAndCharacteristics();
      const controllers = accessory.getControllerNames();
      generateDevicePage(docs_base_path, d, services, controllers);
    }
  } catch (Error) {
    console.log(`Problem generating device page for ${d.vendor} ${d.model}: ${Error}`);
  }
});

// Update JSON files with exposes information used for automated tests
function update_test_input(test_resources: string, json_source: string) {
  if (fs.existsSync(test_resources)) {
    for (const file of fs.readdirSync(test_resources, { withFileTypes: true })) {
      const dst = path.join(test_resources, file.name);
      const src = path.join(json_source, file.name);
      if (file.isDirectory()) {
        // Skip all directories named _manual
        if (file.name === '_manual') {
          continue;
        }
        update_test_input(dst, src);
      } else if (file.isFile()) {
        if (!fs.existsSync(src)) {
          console.log(`TEST INPUT: Source for ${dst} can NOT be FOUND. Removing old file.`);
          fs.unlinkSync(dst);
        } else {
          // Overwrite with new version
          console.log(`TEST INPUT: Updating ${file.name}`);
          fs.copyFileSync(src, dst);
        }
      }
    }
  }
}
update_test_input(test_exposes_base_path, exposes_base_path);

// Group devices per vendor
const devices: Map<string, ExtendedDeviceDefinition[]> = allDevices
  .map((d) => {
    d.vendor = d.vendor.trim();
    return d;
  })
  .reduce((map: Map<string, ExtendedDeviceDefinition[]>, dev: ExtendedDeviceDefinition): Map<string, ExtendedDeviceDefinition[]> => {
    if (dev.vendor.length === 0) {
      console.log(dev);
    }
    const existing = map.get(dev.vendor);
    if (existing !== undefined) {
      existing.push(dev);
    } else {
      map.set(dev.vendor, [dev]);
    }
    return map;
  }, new Map<string, ExtendedDeviceDefinition[]>());

const vendors = [...devices.keys()].sort((a, b) => {
  return a.toLowerCase().localeCompare(b.toLowerCase());
});

// Generate index page
let indexPage = `---
title: "Device support"
description: "Check which Zigbee devices you can control with homebridge-z2m"
---
<!---
This file has been GENERATED using src/docgen/docgen.ts
DO NOT EDIT THIS FILE MANUALLY!
-->
<style type="text/css">
.main-content table {
  table-layout: fixed;
  display: table !important;
}
.main-content table tr th:nth-child(1) {
  width: 20%;
}
.main-content table tr th:nth-child(2) {
  width: 80%;
}
span.vendor {
  float: left;
  width: 130px;
  padding-right: 5px;
}
</style>

# Device support
This page lists the devices currently supported by Zigbee2MQTT v${version_zigbee2mqtt} (which depends on zigbee-herdsman-converters v${version_herdsman_converters}).
Using an automated script, we have checked which HomeKit Services (and Characteristics) would be created for each of these devices.
That way you have some kind of idea of what kind of devices are supported.

Currently there are **${supportedDeviceCounter} supported devices** for which homebridge-z2m will expose at least one HomeKit service.
Unfortunately there are still ${unsupportedDeviceCounter} devices that are not (yet) supported by this plugin, but are supported by Zigbee2MQTT (and expose more than just a _link quality_).

`;

const letters = [...new Set(vendors.map((v) => v.substr(0, 1).toUpperCase()))].sort();
for (const letter of letters) {
  indexPage += `## ${letter}
<div style="clear:both" />
${vendors
  .filter((v) => v.substr(0, 1).toUpperCase() === letter)
  .map((v) => `<span class="vendor">[${v}](index.md#${normalizeNameForAnchor(v)})</span>`)
  .join('\n')}
<div style="clear:both" />

`;
}

for (const vendor of vendors) {
  const vendorDevices = devices.get(vendor)?.sort((a, b) => {
    return a.model.toLowerCase().localeCompare(b.model.toLowerCase());
  });

  if (vendorDevices === undefined || vendorDevices.length === 0) {
    continue;
  }

  indexPage += `
# ${vendor} {#${normalizeNameForAnchor(vendor)}}

| Model | Description |
| ----- | ----------- |
`;

  for (const d of vendorDevices) {
    const page =
      normalizeName(d.whiteLabelOf ? d.whiteLabelOf.vendor : d.vendor) +
      '/' +
      normalizeName(d.whiteLabelOf ? d.whiteLabelOf.model : d.model) +
      '.md';
    let description = d.description || d.whiteLabelOf?.description || '';
    if (d.whiteLabelOf) {
      description = `${description} (white-label of ${d.whiteLabelOf.vendor} ${d.whiteLabelOf.model})`;
    }
    indexPage += `| [${d.model}](${page}) | ${d.vendor} ${description} |\n`;
  }
  indexPage += '\n';
}
fs.writeFileSync(path.join(docs_base_path, 'index.md'), indexPage);
