export function localDatabase(): never {
  throw new Error("Lokalna baza nije dostupna na objavljenom serveru.");
}
