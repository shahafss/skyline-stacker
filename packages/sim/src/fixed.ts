/** 2^32, the modulus of uint32 arithmetic. */
export const U32 = 4294967296;

/** Truncating integer division (research R3): the only place `/` is allowed in the sim. */
export function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Wraps a number into uint32 range. */
export function toU32(v: number): number {
  return v >>> 0;
}

/** Absolute value (thin wrapper; `Math.abs` is allowed in the sim). */
export function abs(v: number): number {
  return Math.abs(v);
}

/** Sign of a number: -1, 0 or 1 (thin wrapper; `Math.sign` is allowed in the sim). */
export function sign(v: number): number {
  return Math.sign(v);
}

/** Smaller of two numbers (thin wrapper; `Math.min` is allowed in the sim). */
export function min(a: number, b: number): number {
  return Math.min(a, b);
}

/** Larger of two numbers (thin wrapper; `Math.max` is allowed in the sim). */
export function max(a: number, b: number): number {
  return Math.max(a, b);
}
