/**
 * Spanish tax identifiers (NIF): the DNI of a Spanish citizen, the NIE of a
 * foreign national, the NIF of other natural persons (K, L, M), and the NIF of
 * a legal entity, still often called CIF (Orden EHA/451/2008). Each has a
 * check character, which this verifies: the DNI's letter, also used for the
 * NIE and for K, L and M, and the entity NIF's control digit or letter.
 * Checking the format and the check character says nothing about whether the
 * identifier was ever issued.
 */

/** The DNI check letters, indexed by the number modulo 23. */
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Entity types whose check character is always a letter. */
const ENTITY_LETTER_ONLY = "NPQRSW";
/** Entity types whose check character is always a digit. */
const ENTITY_DIGIT_ONLY = "ABEH";
/** The check letters of an entity NIF, indexed by the check digit. */
const ENTITY_LETTERS = "JABCDEFGHI";

const DNI = /^(\d{8})([A-Z])$/;
const NIE = /^([XYZ])(\d{7})([A-Z])$/;
const OTHER_PERSON = /^([KLM])(\d{7})([A-Z])$/;
const ENTITY = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;

/** The outcome of checking a text as a NIF. */
export type NifCheck = "valid" | "invalid-format" | "invalid-checksum";

const dniLetter = (digits: string): string => DNI_LETTERS.charAt(Number(digits) % 23);

/** The groups of a match, as text. */
const groups = (match: RegExpExecArray): string[] => match.slice(1).map(String);

function entityCheck(type: string, digits: string, check: string): boolean {
  let sum = 0;
  for (let index = 0; index < 7; index += 1) {
    const digit = Number(digits.charAt(index));
    if (index % 2 === 0) {
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digit;
    }
  }
  const control = (10 - (sum % 10)) % 10;
  const asDigit = String(control);
  const asLetter = ENTITY_LETTERS.charAt(control);
  if (ENTITY_LETTER_ONLY.includes(type)) {
    return check === asLetter;
  }
  if (ENTITY_DIGIT_ONLY.includes(type)) {
    return check === asDigit;
  }
  return check === asDigit || check === asLetter;
}

/**
 * Checks a NIF written in capitals with no spaces or hyphens, such as
 * `12345678Z`, `X1234567L` or `B12345674`.
 */
export function checkNif(nif: string): NifCheck {
  const verdict = (ok: boolean): NifCheck => (ok ? "valid" : "invalid-checksum");
  const dni = DNI.exec(nif);
  if (dni !== null) {
    const [digits, letter] = groups(dni);
    return verdict(letter === dniLetter(String(digits)));
  }
  const nie = NIE.exec(nif);
  if (nie !== null) {
    const [prefix, digits, letter] = groups(nie);
    return verdict(letter === dniLetter(`${"XYZ".indexOf(String(prefix))}${digits}`));
  }
  const other = OTHER_PERSON.exec(nif);
  if (other !== null) {
    const [, digits, letter] = groups(other);
    return verdict(letter === dniLetter(String(digits)));
  }
  const entity = ENTITY.exec(nif);
  if (entity !== null) {
    const [type, digits, check] = groups(entity);
    return verdict(entityCheck(String(type), String(digits), String(check)));
  }
  return "invalid-format";
}
