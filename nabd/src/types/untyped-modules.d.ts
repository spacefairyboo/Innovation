/* Ambient declarations for packages that ship without their own types. */

declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }
  function nspell(dictionary: { aff: Uint8Array; dic: Uint8Array }): NSpell;
  export default nspell;
}

declare module "dictionary-en" {
  const dictionary: { aff: Uint8Array; dic: Uint8Array };
  export default dictionary;
}
