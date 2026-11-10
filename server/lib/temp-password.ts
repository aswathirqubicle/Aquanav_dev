import { randomInt } from "crypto";

/**
 * Letters and digits that cannot be mistaken for one another when read from an
 * email or typed by hand: no 0/O, 1/l/I.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * A random temporary password such as "Xq7m-K29p-Tv4d": three groups of four
 * from a cryptographic source (about 68 bits). Replaces the old
 * "<employee code>@<year>" default, which anyone knowing an employee's code
 * could guess.
 */
export function generateTemporaryPassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}
