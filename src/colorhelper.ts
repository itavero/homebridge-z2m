import * as color_convert from 'color-convert';
import { roundToDecimalPlaces } from './helpers';

// The functions in this file are mostly based on the documentation/code provided by Philips Hue.
// See: https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/

function gammaCorrection(v : number) : number {
  return (v > 0.04045) ? Math.pow((v + 0.055) / (1.0 + 0.055), 2.4) : (v / 12.92);
}

function reverseGammaCorrection(v: number) : number {
  return (v <= 0.0031308) ? 12.92 * v : (1.0 + 0.055) * Math.pow(v, (1.0 / 2.4)) - 0.055;
}

export function convertHueSatToXy(hue: number, saturation: number): [number, number] {
  const rgb = color_convert.hsv.rgb([hue, saturation, 100]);
 
  const red: number = gammaCorrection(rgb[0] / 255);
  const green: number = gammaCorrection(rgb[1] / 255);
  const blue: number = gammaCorrection(rgb[2] / 255);
 
  const X: number = (red * 0.664511) + (green * 0.154324) + (blue * 0.162028);
  const Y: number = (red * 0.283881) + (green * 0.668433) + (blue * 0.047685);
  const Z: number = (red * 0.000088) + (green * 0.072310) + (blue * 0.986039);
  const xyzSum : number = X + Y + Z;
 
  // Round values to at most 5 decimal places, as Zigbee seems to define a 16 bit unsigned integer
  // for these values, which makes the smallest possible step 1/65535 (or approximately 0.000015)
  const x: number = roundToDecimalPlaces((X / xyzSum), 5);
  const y: number = roundToDecimalPlaces((Y / xyzSum), 5);
  return [x, y];
}

export function convertXyToHueSat(x: number, y: number): [number, number] {
  // Based on: https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/
  const z: number = 1.0 - x - y;
  const Y = 1.0;
  const X: number = (Y / y) * x;
  const Z: number = (Y / y) * z;

  // sRGB D65 conversion
  let r: number = (X * 1.656492) - (Y * 0.354851) - (Z * 0.255038);
  let g: number = (-X * 0.707196) + (Y * 1.655397) + (Z * 0.036152);
  let b: number = (X * 0.051713) - (Y * 0.121364) + (Z * 1.011530);

  // Remove negative values
  const m = Math.min(r, g, b);
  if (m < 0.0) {
    r -= m;
    g -= m;
    b -= m;
  }

  // Normalize
  if (r > b && r > g && r > 1.0) {
    // red is too big
    g = g / r;
    b = b / r;
    r = 1.0;
  } else if (g > b && g > r && g > 1.0) {
    // green is too big
    r = r / g;
    b = b / g;
    g = 1.0;
  } else if (b > r && b > g && b > 1.0) {
    // blue is too big
    r = r / b;
    g = g / b;
    b = 1.0;
  }

  // Gamma correction
  r = reverseGammaCorrection(r);
  g = reverseGammaCorrection(g);
  b = reverseGammaCorrection(b);

  // Maximize
  const max = Math.max(r, g, b);
  r = (r === max) ? 255 : (255 * (r / max));
  g = (g === max) ? 255 : (255 * (g / max));
  b = (b === max) ? 255 : (255 * (b / max));

  const hsv = color_convert.rgb.hsv([r, g, b]);

  return [hsv[0], hsv[1]];
}