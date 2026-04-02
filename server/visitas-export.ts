import XlsxPopulate from "xlsx-populate";
import type { ResumenViaticosVisita } from "../client/src/lib/types.js";

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

type GeneratedVisitaExport = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

type VisitaExportViaticoSource = {
  id: string;
  fecha: Date | string;
  tipoGasto: string;
  valor: number;
  descripcion: string;
  observaciones?: string | null;
  usuarioNombre?: string | null;
  soporte?: {
    fileName: string;
  };
};

type VisitaExportSource = {
  id: string;
  clienteId?: string | null;
  clienteNombre?: string | null;
  clienteEmpresa?: string | null;
  prospectoId?: string | null;
  prospectoNombre?: string | null;
  prospectoEmpresa?: string | null;
  tipo: string;
  fecha: Date | string;
  hora: string;
  objetivo: string;
  viaticos?: VisitaExportViaticoSource[];
  resumenViaticos?: ResumenViaticosVisita;
};

type PdfPage = {
  contentObjectNumber: number;
  pageObjectNumber: number;
  lines: string[];
};

function sanitizeFileNameSegment(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "visita";
}

function buildExportFileName(visita: VisitaExportSource, extension: "xlsx" | "pdf") {
  const related = sanitizeFileNameSegment(
    visita.clienteEmpresa ??
      visita.prospectoEmpresa ??
      visita.clienteNombre ??
      visita.prospectoNombre ??
      visita.id
  );

  return `viaticos-${sanitizeFileNameSegment(visita.id)}-${related}.${extension}`;
}

function normalizeDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function formatDate(value: Date | string) {
  const normalized = normalizeDate(value);

  if (Number.isNaN(normalized.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(normalized);
}

function formatMoney(value: number) {
  const roundedValue = Math.round(value);
  const formattedValue = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(roundedValue);

  return `$${formattedValue}`;
}

function getRelacionLabel(visita: VisitaExportSource) {
  return visita.clienteId ? "Cliente" : "Prospecto";
}

function getRelacionadoLabel(visita: VisitaExportSource) {
  const nombre = visita.clienteNombre ?? visita.prospectoNombre ?? "Sin relacion";
  const empresa = visita.clienteEmpresa ?? visita.prospectoEmpresa ?? "";

  return empresa ? `${nombre} - ${empresa}` : nombre;
}

function getVendedoresLabel(visita: VisitaExportSource) {
  const names = Array.from(
    new Set(
      (visita.viaticos ?? [])
        .map(viatico => viatico.usuarioNombre?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  return names.length > 0 ? names.join(", ") : "Sin vendedor registrado";
}

function getSupportUrl(baseUrl: string | undefined, visitaId: string, viaticoId: string) {
  if (!baseUrl) {
    return "";
  }

  return `${baseUrl.replace(/\/+$/, "")}/api/visitas/${encodeURIComponent(
    visitaId
  )}?resource=viaticos&support=1&download=1&viaticoId=${encodeURIComponent(viaticoId)}`;
}

function getResumen(visita: VisitaExportSource): ResumenViaticosVisita {
  return (
    visita.resumenViaticos ?? {
      alimentacion: 0,
      estadia: 0,
      gasolina: 0,
      peajes: 0,
      totalGeneral: 0,
    }
  );
}

function wrapLine(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfDocument(lines: string[]) {
  const maxLinesPerPage = 46;
  const pages: PdfPage[] = [];

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    const pageLines = lines.slice(index, index + maxLinesPerPage);
    const pageObjectNumber = 3 + pages.length * 2;
    const contentObjectNumber = pageObjectNumber + 1;

    pages.push({
      contentObjectNumber,
      lines: pageLines,
      pageObjectNumber,
    });
  }

  const fontObjectNumber = 3 + pages.length * 2;
  const objects: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages
    .map(page => `${page.pageObjectNumber} 0 R`)
    .join(" ")}] >>`;

  for (const page of pages) {
    const contentStream = [
      "BT",
      "/F1 10 Tf",
      "14 TL",
      "40 770 Td",
      ...page.lines.map(line => `(${escapePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");

    objects[page.pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${page.contentObjectNumber} 0 R >>`;
    objects[page.contentObjectNumber] =
      `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`;
  }

  objects[fontObjectNumber] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    const body = `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
    offsets[objectNumber] = Buffer.byteLength(pdf, "utf8");
    pdf += body;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function generateVisitaViaticosExcel(
  visita: VisitaExportSource,
  baseUrl?: string
): Promise<GeneratedVisitaExport> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0);
  const resumen = getResumen(visita);
  const viaticos = visita.viaticos ?? [];

  sheet.name("Viaticos");
  sheet.cell("A1").value("Relacion de Gastos de Viaticos");
  sheet.cell("A1").style({ bold: true, fontSize: 16 });

  const headerRows: Array<[string, string]> = [
    ["Visita ID", visita.id],
    ["Relacion", getRelacionLabel(visita)],
    ["Relacionado", getRelacionadoLabel(visita)],
    ["Fecha visita", formatDate(visita.fecha)],
    ["Hora visita", visita.hora],
    ["Tipo visita", visita.tipo],
    ["Vendedor(es)", getVendedoresLabel(visita)],
    ["Objetivo", visita.objetivo],
  ];

  headerRows.forEach(([label, value], index) => {
    const row = index + 3;
    sheet.cell(`A${row}`).value(label).style({ bold: true });
    sheet.cell(`B${row}`).value(value);
  });

  const tableHeaderRow = headerRows.length + 5;
  const headers = [
    "Fecha",
    "Tipo de gasto",
    "Vendedor",
    "Valor",
    "Descripcion",
    "Observaciones",
    "Soporte",
    "URL soporte",
  ];

  headers.forEach((header, index) => {
    sheet.cell(tableHeaderRow, index + 1).value(header).style({
      bold: true,
      fill: "D9EAF7",
    });
  });

  viaticos.forEach((viatico, index) => {
    const row = tableHeaderRow + 1 + index;

    sheet.cell(`A${row}`).value(formatDate(viatico.fecha));
    sheet.cell(`B${row}`).value(viatico.tipoGasto);
    sheet.cell(`C${row}`).value(viatico.usuarioNombre ?? "Sin vendedor");
    sheet.cell(`D${row}`).value(viatico.valor).style({ numberFormat: '"$"#,##0' });
    sheet.cell(`E${row}`).value(viatico.descripcion);
    sheet.cell(`F${row}`).value(viatico.observaciones ?? "");
    sheet.cell(`G${row}`).value(viatico.soporte?.fileName ?? "");
    sheet.cell(`H${row}`).value(
      viatico.soporte ? getSupportUrl(baseUrl, visita.id, viatico.id) : ""
    );
  });

  const resumenRow = tableHeaderRow + viaticos.length + 3;
  sheet.cell(`A${resumenRow}`).value("Totales").style({ bold: true, fontSize: 12 });

  const resumenItems: Array<[string, number]> = [
    ["Peajes", resumen.peajes],
    ["Gasolina", resumen.gasolina],
    ["Estadia", resumen.estadia],
    ["Alimentacion", resumen.alimentacion],
    ["Total general", resumen.totalGeneral],
  ];

  resumenItems.forEach(([label, value], index) => {
    const row = resumenRow + 1 + index;
    sheet.cell(`A${row}`).value(label).style({ bold: label === "Total general" });
    sheet.cell(`B${row}`).value(value).style({
      bold: label === "Total general",
      numberFormat: '"$"#,##0',
    });
  });

  sheet.column("A").width(16);
  sheet.column("B").width(18);
  sheet.column("C").width(22);
  sheet.column("D").width(14);
  sheet.column("E").width(36);
  sheet.column("F").width(28);
  sheet.column("G").width(26);
  sheet.column("H").width(52);

  const output = await workbook.outputAsync({ type: "nodebuffer" });
  const buffer = Buffer.isBuffer(output)
    ? output
    : Buffer.from(output instanceof ArrayBuffer ? output : output.buffer);

  return {
    buffer,
    contentType: EXCEL_CONTENT_TYPE,
    fileName: buildExportFileName(visita, "xlsx"),
  };
}

export async function generateVisitaViaticosPdf(
  visita: VisitaExportSource,
  _baseUrl?: string
): Promise<GeneratedVisitaExport> {
  const resumen = getResumen(visita);
  const viaticos = visita.viaticos ?? [];
  const lines: string[] = [];

  lines.push("Relacion de Gastos de Viaticos");
  lines.push("");
  lines.push(`Visita ID: ${visita.id}`);
  lines.push(`Relacion: ${getRelacionLabel(visita)}`);
  lines.push(`Relacionado: ${getRelacionadoLabel(visita)}`);
  lines.push(`Fecha visita: ${formatDate(visita.fecha)}`);
  lines.push(`Hora visita: ${visita.hora}`);
  lines.push(`Tipo visita: ${visita.tipo}`);
  lines.push(`Vendedor(es): ${getVendedoresLabel(visita)}`);
  lines.push(`Objetivo: ${visita.objetivo}`);
  lines.push("");
  lines.push("Detalle de gastos");
  lines.push("");

  if (viaticos.length === 0) {
    lines.push("No hay gastos registrados para esta visita.");
  } else {
    viaticos.forEach((viatico, index) => {
      const block = [
        `${index + 1}. ${formatDate(viatico.fecha)} | ${viatico.tipoGasto} | ${formatMoney(
          viatico.valor
        )} | ${viatico.usuarioNombre ?? "Sin vendedor"}`,
        `Descripcion: ${viatico.descripcion}`,
        `Observaciones: ${viatico.observaciones ?? "Sin observaciones"}`,
        viatico.soporte
          ? `Soporte: ${viatico.soporte.fileName}`
          : "Soporte adjunto: No",
        "",
      ];

      block.forEach(line => {
        wrapLine(line, 95).forEach(wrapped => lines.push(wrapped));
      });
    });
  }

  lines.push("Resumen");
  lines.push(`Peajes: ${formatMoney(resumen.peajes)}`);
  lines.push(`Gasolina: ${formatMoney(resumen.gasolina)}`);
  lines.push(`Estadia: ${formatMoney(resumen.estadia)}`);
  lines.push(`Alimentacion: ${formatMoney(resumen.alimentacion)}`);
  lines.push(`Total general: ${formatMoney(resumen.totalGeneral)}`);

  return {
    buffer: buildPdfDocument(lines),
    contentType: PDF_CONTENT_TYPE,
    fileName: buildExportFileName(visita, "pdf"),
  };
}
