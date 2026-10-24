import type { Cell, Worksheet } from "exceljs";
import type { Lesson, SchoolView } from "./types";
import { isManojlo } from "./pricing";
import { dateLabel } from "./time";

const CURRENCY = '#,##0.00" RSD";[Red](#,##0.00)" RSD";"–"';
const INK = "FF243447",
  MUTED = "FF6B7785",
  TEAL = "FF164E63",
  INPUT = "FF245AA8",
  LINK = "FF246753";
type Amounts = {
  price: number | null;
  paid: number;
  balance: number | null;
  boss: number | null;
  teacher: number | null;
  handed: number;
  due: number | null;
};
const sum = (rows: Amounts[], key: keyof Amounts) =>
  rows.reduce((total, row) => total + (row[key] ?? 0), 0);
function formula(cell: Cell, expression: string, result: number | string) {
  cell.value = { formula: expression, result };
}
function fill(cell: Cell, color: string) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color.length === 6 ? `FF${color}` : color },
  };
}
function base(sheet: Worksheet, widths: number[]) {
  sheet.views = [{ showGridLines: false }];
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  sheet.properties.defaultRowHeight = 23;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.4,
      bottom: 0.4,
      header: 0.15,
      footer: 0.15,
    },
  };
  sheet.headerFooter.oddFooter = "&LŠtreberaj&RStrana &P od &N";
}
function title(sheet: Worksheet, end: string, subtitle: string) {
  sheet.mergeCells(`A1:${end}2`);
  const cell = sheet.getCell("A1");
  cell.value = "Štreberaj";
  cell.font = {
    name: "Aptos",
    size: 25,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  cell.alignment = { vertical: "middle", indent: 1 };
  fill(cell, TEAL);
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 22;
  sheet.mergeCells(`A3:${end}3`);
  sheet.getCell("A3").value = subtitle;
  sheet.getCell("A3").font = {
    name: "Aptos",
    size: 13,
    bold: true,
    color: { argb: INK },
  };
  sheet.getRow(3).height = 28;
}
function header(sheet: Worksheet, row: number, labels: string[]) {
  const target = sheet.getRow(row);
  target.values = labels;
  target.height = 34;
  target.eachCell((cell) => {
    fill(cell, TEAL);
    cell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export async function downloadExcelReport(
  view: SchoolView,
  lessons: Lesson[],
  from: string,
  to: string,
  teacherFilter: string,
) {
  // Loaded only when exporting; workbook generation stays in the browser on Cloudflare too.
  const Excel = (await import("exceljs")).default;
  const workbook = new Excel.Workbook();
  workbook.creator = "Štreberaj";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet("Pregled", {
    properties: { tabColor: { argb: TEAL } },
  });
  const detail = workbook.addWorksheet("Časovi", {
    properties: { tabColor: { argb: "FF6594AD" } },
  });
  const selected =
    view.employees.find((employee) => employee.id === teacherFilter)?.name ??
    "Svi dostupni predavači";
  const rows = [...lessons].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.start - b.start ||
      a.teacherId.localeCompare(b.teacherId),
  );
  const amounts: Amounts[] = rows.map((lesson) => {
    const price = lesson.price === null ? null : lesson.price / 100;
    const paid =
      view.payments
        .filter(
          (payment) => payment.lessonId === lesson.id && !payment.voidedAt,
        )
        .reduce((total, payment) => total + payment.amount, 0) / 100;
    const handed =
      view.handovers
        .filter(
          (handover) =>
            handover.lessonId === lesson.id &&
            handover.confirmed &&
            !handover.voidedAt,
        )
        .reduce((total, handover) => total + handover.amount, 0) / 100;
    const boss =
      lesson.price === null || lesson.bossBps === null
        ? null
        : Math.round((lesson.price * lesson.bossBps) / 10000) / 100;
    const owner = isManojlo(
      view.employees.find((employee) => employee.id === lesson.teacherId),
    );
    return {
      price,
      paid,
      handed,
      balance: price === null ? null : price - paid,
      boss,
      teacher: boss === null ? null : price! - boss,
      due: owner ? 0 : boss === null ? null : boss - handed,
    };
  });
  const start = 8,
    last = Math.max(start, start + rows.length - 1);
  const range = (column: string) =>
    `'Časovi'!$${column}$${start}:$${column}$${last}`;
  const missing = rows.filter(
    (lesson) => lesson.price === null || lesson.bossBps === null,
  ).length;

  base(
    detail,
    [13, 10, 12, 25, 24, 12, 19, 19, 19, 13, 19, 19, 19, 19, 14, 34, 18, 23],
  );
  title(detail, "R", "Evidencija održanih časova");
  detail.mergeCells("A4:R4");
  detail.getCell("A4").value =
    `Period: ${dateLabel(from, true)} – ${dateLabel(to, true)}    ${selected}`;
  detail.mergeCells("A5:R5");
  detail.getCell("A5").value =
    "Izvor: evidencija u aplikaciji Štreberaj. Plave ćelije su ulazni podaci; iznosi i salda se računaju formulama.";
  detail.getRow(4).font = { name: "Aptos", size: 11, color: { argb: MUTED } };
  detail.getRow(5).font = { name: "Aptos", size: 10, color: { argb: MUTED } };
  header(detail, 7, [
    "Datum",
    "Početak",
    "Trajanje (min)",
    "Učenik",
    "Predavač",
    "Format",
    "Cena (RSD)",
    "Naplaćeno (RSD)",
    "Dug / preplata",
    "Manojlov deo (%)",
    "Manojlov deo (RSD)",
    "Predavačev deo (RSD)",
    "Predato i potvrđeno",
    "Saldo za predaju",
    "Predaja potrebna",
    "Tematika / beleška",
    "Predavač ID",
    "Obračun",
  ]);
  rows.forEach((lesson, index) => {
    const row = start + index,
      amount = amounts[index];
    const teacher = view.employees.find(
      (employee) => employee.id === lesson.teacherId,
    );
    const complete = lesson.price !== null && lesson.bossBps !== null;
    const values = [
      new Date(lesson.date + "T00:00:00Z"),
      lesson.start / 1440,
      lesson.duration,
      view.students.find((student) => student.id === lesson.studentId)?.name ??
        view.financeLessons?.find((entry) => entry.id === lesson.id)
          ?.studentName ??
        "Učenik",
      teacher?.name ?? "Predavač",
      lesson.mode === "online" ? "Online" : "Uživo",
      amount.price,
      amount.paid,
      null,
      lesson.bossBps === null ? null : lesson.bossBps / 10000,
      null,
      null,
      amount.handed,
      null,
      isManojlo(teacher) ? "Ne" : "Da",
      lesson.topic,
      lesson.teacherId,
      null,
    ];
    const target = detail.getRow(row);
    target.values = values;
    target.height = 29;
    target.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: INK } };
      cell.alignment = { vertical: "middle" };
      fill(cell, index % 2 ? "F3F6F8" : "FFFFFF");
      cell.border = { bottom: { style: "hair", color: { argb: "FFE6EBEF" } } };
    });
    ["A", "B", "C", "D", "E", "F", "G", "H", "J", "M", "O", "P"].forEach(
      (column) =>
        (detail.getCell(`${column}${row}`).font = {
          name: "Aptos",
          size: 10,
          color: { argb: INPUT },
        }),
    );
    detail.getCell(`A${row}`).numFmt = "dd/mm";
    detail.getCell(`B${row}`).numFmt = "hh:mm";
    detail.getCell(`J${row}`).numFmt = "0%";
    ["G", "H", "I", "K", "L", "M", "N"].forEach(
      (column) => (detail.getCell(`${column}${row}`).numFmt = CURRENCY),
    );
    formula(
      detail.getCell(`I${row}`),
      `IF(G${row}="","",ROUND(G${row}-H${row},2))`,
      amount.balance ?? "",
    );
    formula(
      detail.getCell(`K${row}`),
      `IF(OR(G${row}="",J${row}=""),"",ROUND(G${row}*J${row},2))`,
      amount.boss ?? "",
    );
    formula(
      detail.getCell(`L${row}`),
      `IF(K${row}="","",ROUND(G${row}-K${row},2))`,
      amount.teacher ?? "",
    );
    formula(
      detail.getCell(`N${row}`),
      `IF(O${row}="Ne",0,IF(K${row}="","",ROUND(K${row}-M${row},2)))`,
      amount.due ?? "",
    );
    formula(
      detail.getCell(`R${row}`),
      `IF(OR(G${row}="",J${row}=""),"Nepotpun","Potpun")`,
      complete ? "Potpun" : "Nepotpun",
    );
    for (const column of ["G", "H", "M"])
      detail.getCell(`${column}${row}`).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        error: "Unesite nenegativan iznos.",
      };
    detail.getCell(`J${row}`).dataValidation = {
      type: "decimal",
      operator: "between",
      formulae: [0, 1],
      allowBlank: true,
      showErrorMessage: true,
      error: "Unesite procenat od 0% do 100%.",
    };
    detail.getCell(`O${row}`).dataValidation = {
      type: "list",
      formulae: ['"Da,Ne"'],
    };
  });
  detail.getColumn("Q").hidden = true;
  detail.autoFilter = `A7:R${last}`;
  detail.views = [
    {
      state: "frozen",
      xSplit: 4,
      ySplit: 7,
      showGridLines: false,
      activeCell: "A8",
    },
  ];
  detail.pageSetup.printTitlesRow = "1:7";
  detail.pageSetup.printArea = `A1:R${last + 2}`;
  const total = last + 2;
  detail.mergeCells(`A${total}:F${total}`);
  detail.getCell(`A${total}`).value = "UKUPNO";
  for (const [column, key] of [
    ["G", "price"],
    ["H", "paid"],
    ["I", "balance"],
    ["K", "boss"],
    ["L", "teacher"],
    ["M", "handed"],
    ["N", "due"],
  ] as const) {
    formula(
      detail.getCell(`${column}${total}`),
      `SUM(${column}${start}:${column}${last})`,
      sum(amounts, key),
    );
    detail.getCell(`${column}${total}`).numFmt = CURRENCY;
  }
  detail.getRow(total).eachCell((cell) => {
    fill(cell, "DFEAF0");
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: TEAL } };
  });
  for (const column of ["I", "N"])
    detail.addConditionalFormatting({
      ref: `${column}${start}:${column}${last}`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [`AND(ISNUMBER(${column}${start}),${column}${start}>0)`],
          style: {
            font: { color: { argb: "FF9A4B0D" } },
            fill: {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF0D9" },
            },
          },
        },
      ],
    });

  base(summary, [27, 13, 15, 21, 21, 21, 21, 21, 21, 21, 20]);
  title(summary, "J", "Obračun časova");
  summary.mergeCells("A4:J4");
  summary.getCell("A4").value =
    `${dateLabel(from, true)} – ${dateLabel(to, true)}    ${selected}`;
  summary.getRow(4).font = { name: "Aptos", size: 11, color: { argb: MUTED } };
  summary.mergeCells("A5:J5");
  summary.getCell("A5").value =
    view.roundImportedDurations !== false
      ? "Trajanja iz Google tabele zaokružena su naniže na ponuđena trajanja (105 → 90, 75 → 60 min). Automatske cene prate ispravku."
      : "Zaokruživanje trajanja iz Google tabele je isključeno.";
  summary.getCell("A5").font = {
    name: "Aptos",
    size: 10,
    color: { argb: MUTED },
  };
  const metrics = [
    ["A", "B", "Vrednost časova", `SUM(${range("G")})`, sum(amounts, "price")],
    ["C", "D", "Naplaćeno", `SUM(${range("H")})`, sum(amounts, "paid")],
    [
      "E",
      "F",
      "Dugovanja učenika",
      `SUMIF(${range("I")},">0",${range("I")})`,
      amounts.reduce((value, row) => value + Math.max(0, row.balance ?? 0), 0),
    ],
    ["G", "H", "Manojlov deo", `SUM(${range("K")})`, sum(amounts, "boss")],
    ["I", "J", "Saldo za predaju", `SUM(${range("N")})`, sum(amounts, "due")],
  ] as const;
  for (const [left, right, label, expression, value] of metrics) {
    summary.mergeCells(`${left}6:${right}6`);
    summary.mergeCells(`${left}7:${right}8`);
    const heading = summary.getCell(`${left}6`);
    heading.value = label;
    heading.font = { name: "Aptos", size: 11, color: { argb: MUTED } };
    const result = summary.getCell(`${left}7`);
    formula(result, expression, value);
    result.numFmt = CURRENCY;
    result.font = {
      name: "Aptos",
      size: 17,
      bold: true,
      color: { argb: TEAL },
    };
    fill(result, "EAF1F5");
    result.alignment = { vertical: "middle" };
  }
  summary.mergeCells("A10:J10");
  formula(
    summary.getCell("A10"),
    `"Časovi bez cene/procenta: "&COUNTIF(${range("R")},"Nepotpun")`,
    `Časovi bez cene/procenta: ${missing}`,
  );
  summary.getCell("A10").font = {
    name: "Aptos",
    size: 11,
    color: { argb: missing ? "FF9A4B0D" : MUTED },
  };
  header(summary, 12, [
    "Predavač",
    "Broj časova",
    "Minuti",
    "Vrednost časova",
    "Naplaćeno",
    "Dug učenika",
    "Predavačev deo",
    "Manojlov deo",
    "Predato i potvrđeno",
    "Saldo za predaju",
  ]);
  const teachers = view.employees.filter((employee) =>
    rows.some((lesson) => lesson.teacherId === employee.id),
  );
  teachers.forEach((teacher, index) => {
    const row = 13 + index;
    const teacherAmounts = amounts.filter(
      (_, index) => rows[index].teacherId === teacher.id,
    );
    summary.getCell(`A${row}`).value = teacher.name;
    summary.getCell(`K${row}`).value = teacher.id;
    formula(
      summary.getCell(`B${row}`),
      `COUNTIF(${range("Q")},$K${row})`,
      teacherAmounts.length,
    );
    formula(
      summary.getCell(`C${row}`),
      `SUMIF(${range("Q")},$K${row},${range("C")})`,
      rows
        .filter((lesson) => lesson.teacherId === teacher.id)
        .reduce((value, lesson) => value + lesson.duration, 0),
    );
    for (const [target, source, key] of [
      ["D", "G", "price"],
      ["E", "H", "paid"],
      ["G", "L", "teacher"],
      ["H", "K", "boss"],
      ["I", "M", "handed"],
      ["J", "N", "due"],
    ] as const)
      formula(
        summary.getCell(`${target}${row}`),
        `SUMIF(${range("Q")},$K${row},${range(source)})`,
        sum(teacherAmounts, key),
      );
    formula(
      summary.getCell(`F${row}`),
      `SUMIFS(${range("I")},${range("Q")},$K${row},${range("I")},">0")`,
      teacherAmounts.reduce(
        (value, amount) => value + Math.max(0, amount.balance ?? 0),
        0,
      ),
    );
    summary.getRow(row).height = 29;
    summary.getRow(row).eachCell((cell, column) => {
      cell.font = {
        name: "Aptos",
        size: 11,
        color: { argb: column === 1 ? INK : LINK },
      };
      fill(cell, index % 2 ? "F3F6F8" : "FFFFFF");
      if (column >= 4 && column <= 10) cell.numFmt = CURRENCY;
    });
    summary.getCell(`A${row}`).border = {
      left: {
        style: "medium",
        color: { argb: `FF${teacher.color.replace("#", "")}` },
      },
    };
  });
  const end = Math.max(13, 12 + teachers.length);
  const summaryTotal = end + 2;
  summary.getCell(`A${summaryTotal}`).value = "UKUPNO";
  const cached = [
    rows.length,
    rows.reduce((value, lesson) => value + lesson.duration, 0),
    sum(amounts, "price"),
    sum(amounts, "paid"),
    amounts.reduce(
      (value, amount) => value + Math.max(0, amount.balance ?? 0),
      0,
    ),
    sum(amounts, "teacher"),
    sum(amounts, "boss"),
    sum(amounts, "handed"),
    sum(amounts, "due"),
  ];
  ["B", "C", "D", "E", "F", "G", "H", "I", "J"].forEach((column, index) => {
    formula(
      summary.getCell(`${column}${summaryTotal}`),
      `SUM(${column}13:${column}${end})`,
      cached[index],
    );
    if (index >= 2)
      summary.getCell(`${column}${summaryTotal}`).numFmt = CURRENCY;
  });
  summary.getRow(summaryTotal).eachCell((cell) => {
    fill(cell, "DFEAF0");
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: TEAL } };
  });
  summary.getColumn("K").hidden = true;
  summary.views = [
    { state: "frozen", ySplit: 12, showGridLines: false, activeCell: "A13" },
  ];
  summary.pageSetup.printArea = `A1:J${summaryTotal}`;
  if (!rows.length) {
    summary.mergeCells("A13:J13");
    summary.getCell("A13").value = "Nema održanih časova za izabrani period.";
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer).buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const download = document.createElement("a");
  download.href = url;
  download.download = `Streberaj-obracun-${from}-${to}.xlsx`;
  document.body.appendChild(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
