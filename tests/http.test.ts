import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
test(
  "HTTP integracija u izdvojenoj probnoj bazi",
  { skip: !base },
  async (t) => {
    async function state(actor = "admin") {
      const r = await fetch(base + "/api/state", {
        headers: { Cookie: "demo-actor=" + actor },
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    async function command(
      type: string,
      payload: unknown,
      actor = "admin",
      key = crypto.randomUUID(),
    ) {
      return fetch(base + "/api/command", {
        method: "POST",
        headers: {
          Origin: base!,
          Cookie: "demo-actor=" + actor,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ type, payload }),
      });
    }
    const occupied = [
      ...(await state()).lessons,
      ...(await state("ana")).lessons,
    ];
    let testDate = "2080-01-01";
    const plus = (date: string, n: number) => {
      const d = new Date(date + "T12:00Z");
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    while (
      occupied.some(
        (l: any) => l.date >= testDate && l.date <= plus(testDate, 2),
      )
    )
      testDate = plus(testDate, 3);
    const name = "Provera " + crypto.randomUUID().slice(0, 8);
    let lesson: any;
    await t.test(
      "brzi unos se trajno čuva i ponovljen zahtev se ne duplira",
      async () => {
        const key = crypto.randomUUID(),
          data = { name, date: testDate, start: 600, desk: 1 };
        const a = await command("quickLesson", data, "admin", key);
        assert.equal(a.status, 200, await a.clone().text());
        lesson = (await a.json()).view.lessons.find(
          (l: any) => l.date === data.date,
        );
        const b = await command("quickLesson", data, "admin", key);
        assert.equal(b.status, 200);
        const s = await state();
        assert.equal(
          s.lessons.filter((l: any) => l.id === lesson.id).length,
          1,
        );
        assert.equal(lesson.duration, 45);
      },
    );
    await t.test(
      "ponovljena uplata sa istim ključem se ne knjiži dvaput",
      async () => {
        let r = await command("saveLesson", {
          ...lesson,
          price: 100000,
          bossBps: 3000,
          status: "completed",
        });
        assert.equal(r.status, 200);
        lesson = (await r.json()).view.lessons.find(
          (l: any) => l.id === lesson.id,
        );
        const key = crypto.randomUUID(),
          payload = { lessonId: lesson.id, amount: 100000, date: lesson.date };
        assert.equal(
          (await command("payment", payload, "admin", key)).status,
          200,
        );
        assert.equal(
          (await command("payment", payload, "admin", key)).status,
          200,
        );
        const s = await state();
        assert.equal(
          s.payments.filter((p: any) => p.lessonId === lesson.id).length,
          1,
        );
        assert.equal(
          s.students.find((st: any) => st.id === lesson.studentId).total,
          1,
        );
      },
    );
    await t.test("paralelne rezervacije ne probijaju kapacitet", async () => {
      const make = (studentId: string, teacherId: string) => ({
          ...lesson,
          id: undefined,
          studentId,
          teacherId,
          date: plus(testDate, 1),
          start: 600,
          status: "scheduled",
        }),
        s = await state();
      const responses = await Promise.all([
        command("saveLesson", make(s.students[0].id, "admin")),
        command("saveLesson", make(s.students[1].id, "ana")),
        command("saveLesson", make(s.students[2].id, "marko")),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 409]);
      const booked = (await state()).lessons.filter(
        (l: any) => l.date === plus(testDate, 1) && l.start === 600,
      );
      assert.deepEqual(booked.map((l: any) => l.desk).sort(), [1, 2]);
    });
    await t.test(
      "privatni online podaci se ne pojavljuju u administratorskom odgovoru",
      async () => {
        const r = await command(
          "quickLesson",
          {
            name: name + " online",
            date: plus(testDate, 2),
            start: 600,
            desk: null,
          },
          "ana",
        );
        assert.equal(r.status, 200);
        const result = await r.json(),
          id = result.entityId;
        assert(!(await state()).lessons.some((l: any) => l.id === id));
        const own = (await state("ana")).lessons.find((l: any) => l.id === id);
        const shared = await command(
          "saveLesson",
          { ...own, shared: true },
          "ana",
        );
        assert.equal(shared.status, 200);
        assert((await state()).lessons.some((l: any) => l.id === id));
      },
    );
    await t.test("CSRF zahtev i izmena bez dozvole se odbijaju", async () => {
      const bad = await fetch(base + "/api/command", {
        method: "POST",
        headers: {
          Origin: "https://drugi-sajt.example",
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ type: "saveLesson", payload: lesson }),
      });
      assert.equal(bad.status, 403);
      assert.equal(
        (
          await command(
            "saveLesson",
            { ...lesson, topic: "Neovlašćeno" },
            "marko",
          )
        ).status,
        403,
      );
    });
    await t.test(
      "privatni prilog prolazi proveru vlasništva i sadržaja",
      async () => {
        const form = new FormData();
        form.set("lessonId", lesson.id);
        form.set("kind", "proof");
        form.set(
          "file",
          new File(["%PDF-1.4\n%%EOF"], "dokaz.pdf", {
            type: "application/pdf",
          }),
        );
        const r = await fetch(base + "/api/files", {
          method: "POST",
          headers: { Origin: base!, Cookie: "demo-actor=admin" },
          body: form,
        });
        assert.equal(r.status, 200, await r.clone().text());
        const { id } = await r.json();
        assert.equal((await fetch(base + "/api/files/" + id)).status, 200);
        assert.equal(
          (
            await fetch(base + "/api/files/" + id, {
              headers: { Cookie: "demo-actor=marko" },
            })
          ).status,
          403,
        );
      },
    );
  },
);
