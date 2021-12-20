import 'jest-chain';
import { exposesCollectionsAreEqual, ExposesEntryWithEnumProperty, ExposesEntryWithFeatures, exposesGetOverlap } from '../src/z2mModels';

describe('exposesGetOverlap', () => {

  const lightA = `[
    {
      "type": "light",
      "features": [
        {
          "type": "binary",
          "name": "state",
          "property": "state",
          "access": 7,
          "value_on": "ON",
          "value_off": "OFF",
          "value_toggle": "TOGGLE",
          "description": "On/off state of this light"
        },
        {
          "type": "numeric",
          "name": "brightness",
          "property": "brightness",
          "access": 7,
          "value_min": 0,
          "value_max": 254,
          "description": "Brightness of this light"
        },
        {
          "type": "numeric",
          "name": "color_temp",
          "property": "color_temp",
          "access": 7,
          "unit": "mired",
          "value_min": 153,
          "value_max": 454,
          "description": "Color temperature of this light",
          "presets": [
            {
              "name": "coolest",
              "value": 153,
              "description": "Coolest temperature supported"
            },
            {
              "name": "cool",
              "value": 250,
              "description": "Cool temperature (250 mireds / 4000 Kelvin)"
            },
            {
              "name": "neutral",
              "value": 370,
              "description": "Neutral temperature (370 mireds / 2700 Kelvin)"
            },
            {
              "name": "warm",
              "value": 454,
              "description": "Warm temperature (454 mireds / 2200 Kelvin)"
            },
            {
              "name": "warmest",
              "value": 454,
              "description": "Warmest temperature supported"
            }
          ]
        },
        {
          "type": "numeric",
          "name": "color_temp_startup",
          "property": "color_temp_startup",
          "access": 7,
          "unit": "mired",
          "value_min": 153,
          "value_max": 454,
          "description": "Color temperature after cold power on of this light",
          "presets": [
            {
              "name": "coolest",
              "value": 153,
              "description": "Coolest temperature supported"
            },
            {
              "name": "cool",
              "value": 250,
              "description": "Cool temperature (250 mireds / 4000 Kelvin)"
            },
            {
              "name": "neutral",
              "value": 370,
              "description": "Neutral temperature (370 mireds / 2700 Kelvin)"
            },
            {
              "name": "warm",
              "value": 454,
              "description": "Warm temperature (454 mireds / 2200 Kelvin)"
            },
            {
              "name": "warmest",
              "value": 454,
              "description": "Warmest temperature supported"
            },
            {
              "name": "previous",
              "value": 65535,
              "description": "Restore previous color_temp on cold power on"
            }
          ]
        }
      ]
    },
    {
      "type": "enum",
      "name": "effect",
      "property": "effect",
      "access": 2,
      "values": [
        "blink",
        "breathe",
        "okay",
        "channel_change",
        "finish_effect",
        "stop_effect"
      ],
      "description": "Triggers an effect on the light (e.g. make light blink for a few seconds)"
    },
    {
      "type": "numeric",
      "name": "linkquality",
      "property": "linkquality",
      "access": 1,
      "unit": "lqi",
      "description": "Link quality (signal strength)",
      "value_min": 0,
      "value_max": 255
    }
  ]`;

  const lightB = `[
    {
      "type": "light",
      "features": [
        {
          "type": "binary",
          "name": "state",
          "property": "state",
          "access": 7,
          "value_on": "ON",
          "value_off": "OFF",
          "value_toggle": "TOGGLE",
          "description": "On/off state of this light"
        },
        {
          "type": "numeric",
          "name": "brightness",
          "property": "brightness",
          "access": 7,
          "value_min": 0,
          "value_max": 254,
          "description": "Brightness of this light"
        },
        {
          "type": "numeric",
          "name": "color_temp",
          "property": "color_temp",
          "access": 7,
          "unit": "mired",
          "value_min": 150,
          "value_max": 500,
          "description": "Color temperature of this light",
          "presets": [
            {
              "name": "coolest",
              "value": 150,
              "description": "Coolest temperature supported"
            },
            {
              "name": "cool",
              "value": 250,
              "description": "Cool temperature (250 mireds / 4000 Kelvin)"
            },
            {
              "name": "neutral",
              "value": 370,
              "description": "Neutral temperature (370 mireds / 2700 Kelvin)"
            },
            {
              "name": "warm",
              "value": 454,
              "description": "Warm temperature (454 mireds / 2200 Kelvin)"
            },
            {
              "name": "warmest",
              "value": 500,
              "description": "Warmest temperature supported"
            }
          ]
        },
        {
          "type": "numeric",
          "name": "color_temp_startup",
          "property": "color_temp_startup",
          "access": 7,
          "unit": "mired",
          "value_min": 150,
          "value_max": 500,
          "description": "Color temperature after cold power on of this light",
          "presets": [
            {
              "name": "coolest",
              "value": 150,
              "description": "Coolest temperature supported"
            },
            {
              "name": "cool",
              "value": 250,
              "description": "Cool temperature (250 mireds / 4000 Kelvin)"
            },
            {
              "name": "neutral",
              "value": 370,
              "description": "Neutral temperature (370 mireds / 2700 Kelvin)"
            },
            {
              "name": "warm",
              "value": 454,
              "description": "Warm temperature (454 mireds / 2200 Kelvin)"
            },
            {
              "name": "warmest",
              "value": 500,
              "description": "Warmest temperature supported"
            },
            {
              "name": "previous",
              "value": 65535,
              "description": "Restore previous color_temp on cold power on"
            }
          ]
        },
        {
          "type": "composite",
          "property": "color",
          "name": "color_xy",
          "features": [
            {
              "type": "numeric",
              "name": "x",
              "property": "x",
              "access": 7
            },
            {
              "type": "numeric",
              "name": "y",
              "property": "y",
              "access": 7
            }
          ],
          "description": "Color of this light in the CIE 1931 color space (x/y)"
        },
        {
          "type": "composite",
          "property": "color",
          "name": "color_hs",
          "features": [
            {
              "type": "numeric",
              "name": "hue",
              "property": "hue",
              "access": 7
            },
            {
              "type": "numeric",
              "name": "saturation",
              "property": "saturation",
              "access": 7
            }
          ],
          "description": "Color of this light expressed as hue/saturation"
        }
      ]
    },
    {
      "type": "enum",
      "name": "effect",
      "property": "effect",
      "access": 2,
      "values": [
        "blink",
        "breathe",
        "okay",
        "channel_change",
        "finish_effect",
        "stop_effect"
      ],
      "description": "Triggers an effect on the light (e.g. make light blink for a few seconds)"
    },
    {
      "type": "numeric",
      "name": "linkquality",
      "property": "linkquality",
      "access": 1,
      "unit": "lqi",
      "description": "Link quality (signal strength)",
      "value_min": 0,
      "value_max": 255
    }
  ]`;

  test('Equal input results in equal output', () => {
    const exposesA = JSON.parse(lightA);
    const overlap = exposesGetOverlap(exposesA, exposesA);
    expect(overlap).not.toBeUndefined();
    expect(exposesCollectionsAreEqual(exposesA, overlap)).toBeTruthy();
  });

  test('Light with color and light without color combined', () => {
    const exposesA = JSON.parse(lightA);
    const exposesB = JSON.parse(lightB);
    const overlap = exposesGetOverlap(exposesA, exposesB);
    expect(overlap).not.toBeUndefined();
    expect(overlap.length).toBe(3);
    expect(overlap.findIndex(e => e.name === 'linkquality')).toBeGreaterThanOrEqual(0);

    const effectExpose = overlap.find(e => e.name === 'effect') as ExposesEntryWithEnumProperty;
    expect(effectExpose).not.toBeUndefined();
    expect(effectExpose.values.length).toEqual(6);

    const lightExpose = overlap.find(e => e.type === 'light') as ExposesEntryWithFeatures;
    expect(lightExpose).not.toBeUndefined();
    expect(lightExpose.features.length).toEqual(4);

    expect(exposesCollectionsAreEqual(overlap, exposesA)).toBeFalsy();
    expect(exposesCollectionsAreEqual(overlap, exposesB)).toBeFalsy();
  });
});