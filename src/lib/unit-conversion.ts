export const UNIT_BASE_FACTORS = {
  inch: 0.0254,
  foot: 0.3048,
  yard: 0.9144,
  mile: 1609.344,
  millimeter: 0.001,
  centimeter: 0.01,
  meter: 1,
  kilometer: 1000,
  ounce: 0.028349523125,
  pound: 0.45359237,
  gram: 0.001,
  kilogram: 1,
  teaspoon: 0.00492892159375,
  tablespoon: 0.01478676478125,
  fluidOunce: 0.0295735295625,
  cup: 0.2365882365,
  pint: 0.473176473,
  quart: 0.946352946,
  gallon: 3.785411784,
  milliliter: 0.001,
  liter: 1,
} as const;

export function convertLinearMeasurement(
  value: number,
  fromBaseFactor: number,
  toBaseFactor: number
) {
  return (value * fromBaseFactor) / toBaseFactor;
}

export function fahrenheitToCelsius(value: number) {
  return ((value - 32) * 5) / 9;
}

export function celsiusToFahrenheit(value: number) {
  return (value * 9) / 5 + 32;
}
