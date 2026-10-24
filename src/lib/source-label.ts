export function studentNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("sr-Latn");
}

export function parseSourceLabel(text: string) {
  const match = text
    .trim()
    .match(/^(.*?)\s+(\d+\s*\/\s*\d+(?:\s*,\s*\d+\s*\/\s*\d+)*)\s*$/);
  if (!match) return { name: text.trim() };
  const pairs = [...match[2].matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => ({
    number: Number(m[1]),
    size: Number(m[2]),
  }));
  if (
    !match[1].trim() ||
    pairs.some(
      (p) => p.size < 1 || p.size > 200 || p.number < 1 || p.number > p.size,
    ) ||
    pairs.some((p) => p.size !== pairs[0].size)
  )
    return {
      name: match[1].trim(),
      issue: "Nejasan brojač u izvoru; proverite oznaku časa.",
    };
  return {
    name: match[1].trim(),
    counter: { numbers: pairs.map((p) => p.number), size: pairs[0].size },
  };
}

export function canCreateSourceStudent(name: string) {
  return (
    name.length >= 1 &&
    name.length <= 160 &&
    !/[/?\d]/.test(name) &&
    !/^(otkazan[oa]?|zamena|ispala|jedan|fon)$/i.test(name)
  );
}
