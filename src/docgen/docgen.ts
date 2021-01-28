/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable max-len */
import fs from 'fs';
import path from 'path';
import * as herdsman from 'zigbee-herdsman-converters';
import { BasicServiceCreatorManager } from '../converters/creators';
import { DocsAccessory } from './docs_accessory';
import { ExposesEntry } from '../z2mModels';
import * as hapNodeJs from 'hap-nodejs';
import { setHap } from '../hap';
import { Service, WithUUID } from 'hap-nodejs';
import { version_herdsman_converters, version_zigbee2mqtt } from './versions';

const base = path.join(__dirname, '..', '..', 'docs', 'devices');
setHap(hapNodeJs);

// Clean devices directory
for (const file of fs.readdirSync(base, { withFileTypes: true })) {
  const p = path.join(base, file.name);
  if (file.isDirectory()) {
    fs.rmdirSync(p, { recursive: true });
  } else if (file.isFile()) {
    fs.unlinkSync(p);
  }
}

function normalizeName(model: string): string {
  const find = '[/ :\\(\\)\\.]+';
  const re = new RegExp(find, 'g');
  return model.replace(re, '_')
    .replace(/_+$/, '').toLocaleLowerCase();
}

function generateZigbee2MqttLink(device: any) {
  const find = '[/| |:]';
  const re = new RegExp(find, 'g');
  return 'https://www.zigbee2mqtt.io/devices/' + encodeURIComponent(device.model.replace(re, '_')) + '.html';
}

// Service names / links
class ServiceInfo {
  constructor(readonly serviceName: string, readonly page: string | undefined = undefined) { }
}
const hiddenCharacteristics = new Set<string>([
  hapNodeJs.Characteristic.Name.UUID,
]);
const characteristicNameMapping = new Map<string, string>([
  ['E863F10F-079E-48FF-8F27-9C2605A29F52', 'Air Pressure'],
]);

function addServiceMapping(service: WithUUID<{ new(): Service }>, page?: string): [string, ServiceInfo] {
  // Secretly also tries to add all the characteristics to the lookup table.
  try {
    const s = new service();
    for (const char of s.characteristics) {
      characteristicNameMapping.set(char.UUID, char.constructor.name);
    }
    for (const char of s.optionalCharacteristics) {
      characteristicNameMapping.set(char.UUID, char.constructor.name);
    }
  } catch (err) {
    // ignore
  }

  return [service.UUID, new ServiceInfo(service.name ?? 'DOCGEN FAILURE', page)];
}

const serviceNameMapping = new Map<string, ServiceInfo>([
  addServiceMapping(hapNodeJs.Service.Lightbulb, 'light.md'),
  addServiceMapping(hapNodeJs.Service.StatelessProgrammableSwitch, 'action.md'),
  addServiceMapping(hapNodeJs.Service.WindowCovering, 'cover.md'),
  addServiceMapping(hapNodeJs.Service.BatteryService, 'battery.md'),
  addServiceMapping(hapNodeJs.Service.LockMechanism, 'lock.md'),
  addServiceMapping(hapNodeJs.Service.Switch, 'switch.md'),
  addServiceMapping(hapNodeJs.Service.HumiditySensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.TemperatureSensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.LightSensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.ContactSensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.SmokeSensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.OccupancySensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.CarbonMonoxideSensor, 'sensors.md'),
  addServiceMapping(hapNodeJs.Service.LeakSensor, 'sensors.md'),
  ['E863F00A-079E-48FF-8F27-9C2605A29F52', new ServiceInfo('Air Pressure Sensor', 'sensors.md')],
]);


const servicesIgnoredForDeterminingSupport = new Set<string>([
  hapNodeJs.Service.BatteryService.UUID,
]);

let supportedDeviceCounter = 0;
let unsupportedDeviceCounter = 0;

function characteristicIdsToMarkdown(characteristics: string[]): string {
  if (characteristics.length === 0) {
    throw new Error('No characteristics for service!?');
  }

  const unknownCharacteristics = characteristics.filter(c => !characteristicNameMapping.has(c));
  if (unknownCharacteristics.length > 0) {
    console.log(`Unknown characteristic IDs:\n${unknownCharacteristics.sort().join('\n')}`);
  }

  return characteristics
    .filter(id => !hiddenCharacteristics.has(id))
    .map(id => characteristicNameMapping.get(id) ?? '')
    .filter(n => n.length > 0)
    .sort()
    .map(n => `  * ${n}\n`)
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

function generateDevicePage(basePath: string, device: any, services: Map<string, string[]>) {
  if (device.whiteLabelOf) {
    // Don't generate device page for white label products.
    return;
  }

  const directory = path.join(base, normalizeName(device.vendor));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
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
    devicePage += `\n## White-label models\n${device.whiteLabel.map((d) => `* [${d.vendor}](../index.md#${normalizeName(d.vendor)}) ${d.model}`).join('\n')}\n`;
  }

  if (services.size === 0) {
    unsupportedDeviceCounter += 1 + whiteLabelCount;
    console.log(`[UNSUPPORTED] ${device.vendor} ${device.model} does NOT expose any HomeKit services.`);
    devicePage += `
# Unsupported
This device is currently *UNSUPPORTED*.
Want to have this device supported? Please check the [GitHub issue section](https://github.com/itavero/homebridge-z2m/issues?q=${encodeURIComponent(device.model)}) to see if a request already exists for this device.
If it doesn't exist yet, you can [open a new request](https://github.com/itavero/homebridge-z2m/issues/new?assignees=&labels=enhancement&template=device_support.md&title=%5BDevice%5D+${encodeURIComponent(device.vendor)}+${encodeURIComponent(device.model)}) by filling in the _Device support_ issue template.

## Exposes
\`\`\`json
${JSON.stringify(device.exposes, null, 2)}
\`\`\`
`;
  } else {
    // Should we consider this device to be supported?
    const supportedService = [...services.keys()].findIndex(s => !servicesIgnoredForDeterminingSupport.has(s));
    if (supportedService >= 0) {
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

`;

  }

  // Add related links
  devicePage += `# Related
* [Other devices from ${device.vendor}](../index.md#${normalizeName(device.vendor)})
* [Zigbee2MQTT documentation for this device](${generateZigbee2MqttLink(device)})`;
  fs.writeFileSync(fileName, devicePage);
}

// Add white label devices
const allDevices = herdsman.devices;
for (const device of allDevices) {
  if (device.whiteLabel) {
    for (const whiteLabel of device.whiteLabel) {
      const whiteLabelDevice = {
        ...device,
        model: whiteLabel.model,
        vendor: whiteLabel.vendor,
        description: whiteLabel.description,
        whiteLabelOf: device,
      };

      delete whiteLabelDevice.whiteLabel;
      allDevices.push(whiteLabelDevice);
    }
  }
}

// Check services for all non white label devices
function checkServicesAndCharacteristics(device: any): Map<string, string[]> {
  const exposes = device.exposes.map(e => e as ExposesEntry);
  const accessory = new DocsAccessory(`${device.vendor} ${device.model}`);
  BasicServiceCreatorManager.getInstance().createHomeKitEntitiesFromExposes(accessory, exposes);
  return accessory.getServicesAndCharacteristics();
}

allDevices.forEach(d => {
  try {
    if (d.whiteLabelOf === undefined) {
      const services = checkServicesAndCharacteristics(d);
      generateDevicePage(base, d, services);
    }
  } catch (Error) {
    console.log(`Problem generating device page for ${d.vendor} ${d.model}: ${Error}`);
  }
});

// Group devices per vendor
const devices: Map<string, any[]> = allDevices.map(d => {
  d.vendor = d.vendor.trim();
  return d;
}).reduce((map: Map<string, any[]>, dev: any): Map<string, any[]> => {
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
}, new Map<string, any[]>());

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
Unfortunately there are still ${unsupportedDeviceCounter} devices that are not yet supported by this plugin, but are supported by Zigbee2MQTT.

`;

const letters = [...new Set(vendors.map(v => v.substr(0, 1).toUpperCase()))].sort();
for (const letter of letters) {
  indexPage += `## ${letter}
<div style="clear:both" />
${vendors.filter(v => v.substr(0, 1).toUpperCase() === letter).map(v => `<span class="vendor">[${v}](index.md#${normalizeName(v)})</span>`).join('\n')}
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
# ${vendor} {#${normalizeName(vendor)}}

| Model | Description |
| ----- | ----------- |
`;

  for (const d of vendorDevices) {
    const page = normalizeName(d.whiteLabelOf ? d.whiteLabelOf.vendor : d.vendor) + '/' + normalizeName(d.whiteLabelOf ? d.whiteLabelOf.model : d.model) + '.md';
    let description = d.description || d.whiteLabelOf.description;
    if (d.whiteLabelOf) {
      description = `${description} (white-label of ${d.whiteLabelOf.vendor} ${d.whiteLabelOf.model})`;
    }
    indexPage += `| [${d.model}](${page}) | ${d.vendor} ${description} |\n`;
  }
  indexPage += '\n';
}
fs.writeFileSync(path.join(base, 'index.md'), indexPage);