/* Libraries */
import { isArray } from "util";

/* General Functions */
const toHex = (numbers: number | number[]) => {
  const nums = isArray(numbers) ? numbers : [numbers];

  return nums.map(n => `0x${Buffer.from([n]).toString('hex')}`);
}

/* Exporting functions */
export {
  toHex
}