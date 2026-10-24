import { ZodError } from "zod";
import { DomainError } from "./domain";
export const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export function failure(error: unknown) {
  if (error instanceof ZodError) {
    const labels: Record<string, string> = {
      name: "Ime",
      email: "Imejl",
      date: "Datum",
      start: "Početak",
      duration: "Trajanje",
      price: "Cena",
      bossBps: "Manojlov procenat",
      amount: "Iznos",
      packageSize: "Broj časova u paketu",
      firstYear: "Početna godina",
      spreadsheetId: "Google tabela",
      teacherId: "Predavač",
      studentId: "Učenik",
      color: "Boja",
      topic: "Tematika",
    };
    return json(
      {
        error: error.issues
          .map((i) => {
            const field = labels[String(i.path[0])] ?? "Podatak",
              message =
                i.code === "custom"
                  ? i.message
                  : i.code === "too_small"
                    ? "Najmanja dozvoljena vrednost je " +
                      String(i.minimum) +
                      "."
                    : i.code === "too_big"
                      ? "Najveća dozvoljena vrednost je " +
                        String(i.maximum) +
                        "."
                      : "Unesite ispravnu vrednost.";
            return field + ": " + message;
          })
          .join(" "),
      },
      400,
    );
  }
  if (error instanceof SyntaxError)
    return json({ error: "Zahtev nije ispravan JSON." }, 400);
  if (error instanceof DomainError)
    return json({ error: error.message }, error.status);
  console.error(
    "Greška aplikacije:",
    error instanceof Error ? error.message : "Nepoznata greška",
  );
  return json({ error: "Došlo je do greške. Pokušajte ponovo." }, 500);
}
