import XlsxPopulate from "xlsx-populate";
import {
  ContableLegalizacionViaticoEstado,
  ViaticoTipoGasto,
  type ContableLegalizacionViatico,
} from "../client/src/lib/types.js";

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

type GeneratedContableViaticosExport = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
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

  return normalized || "viaticos";
}

function buildTimestampSegment() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}`;
}

function buildExportFileName(extension: "xlsx" | "pdf") {
  return `legalizacion-viaticos-${sanitizeFileNameSegment(
    buildTimestampSegment()
  )}.${extension}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatMoney(value: number) {
  const roundedValue = Math.round(value);
  const formattedValue = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(roundedValue);

  return `$${formattedValue}`;
}

function formatEstadoLabel(estado: ContableLegalizacionViaticoEstado) {
  switch (estado) {
    case ContableLegalizacionViaticoEstado.PENDIENTE:
      return "Pendiente";
    case ContableLegalizacionViaticoEstado.LEGALIZADO:
      return "Legalizado";
    case ContableLegalizacionViaticoEstado.APROBADO:
      return "Aprobado";
    case ContableLegalizacionViaticoEstado.RECHAZADO:
      return "Rechazado";
    default:
      return estado;
  }
}

function formatTipoGastoLabel(tipo: ViaticoTipoGasto) {
  switch (tipo) {
    case ViaticoTipoGasto.PEAJES:
      return "Peajes";
    case ViaticoTipoGasto.GASOLINA:
      return "Gasolina";
    case ViaticoTipoGasto.ESTADIA:
      return "Estadia";
    case ViaticoTipoGasto.ALIMENTACION:
      return "Alimentacion";
    default:
      return tipo;
  }
}

function getRelacionadoLabel(item: ContableLegalizacionViatico) {
  const nombre = item.relacionadoNombre ?? "Sin relacionado";
  const empresa = item.relacionadoEmpresa ?? "";
  return empresa ? `${nombre} - ${empresa}` : nombre;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

  objects[fontObjectNumber] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

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

function buildSummary(items: ContableLegalizacionViatico[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += item.valor;
      acc.tipos[item.tipoGasto] += item.valor;
      acc.estados[item.legalizacionEstado] += 1;
      return acc;
    },
    {
      estados: {
        [ContableLegalizacionViaticoEstado.PENDIENTE]: 0,
        [ContableLegalizacionViaticoEstado.LEGALIZADO]: 0,
        [ContableLegalizacionViaticoEstado.APROBADO]: 0,
        [ContableLegalizacionViaticoEstado.RECHAZADO]: 0,
      },
      tipos: {
        [ViaticoTipoGasto.PEAJES]: 0,
        [ViaticoTipoGasto.GASOLINA]: 0,
        [ViaticoTipoGasto.ESTADIA]: 0,
        [ViaticoTipoGasto.ALIMENTACION]: 0,
      },
      total: 0,
    }
  );
}

function buildFiltersLabel(filters: {
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  vendedorNombre?: string;
}) {
  const parts = [
    filters.vendedorNombre ? `Vendedor: ${filters.vendedorNombre}` : "",
    filters.estado ? `Estado: ${filters.estado}` : "",
    filters.fechaDesde ? `Desde: ${filters.fechaDesde}` : "",
    filters.fechaHasta ? `Hasta: ${filters.fechaHasta}` : "",
    filters.q ? `Busqueda: ${filters.q}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Sin filtros adicionales";
}

export async function generateContableViaticosExcel(
  items: ContableLegalizacionViatico[],
  filters: {
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    q?: string;
    vendedorNombre?: string;
  }
): Promise<GeneratedContableViaticosExport> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0);
  const summary = buildSummary(items);

  sheet.name("Legalizacion");
  sheet.cell("A1").value("Legalizacion de Viaticos");
  sheet.cell("A1").style({ bold: true, fontSize: 16 });

  const headerRows: Array<[string, string]> = [
    ["Fecha exportacion", formatDate(new Date())],
    ["Filtros", buildFiltersLabel(filters)],
    ["Registros", String(items.length)],
    ["Total general", formatMoney(summary.total)],
  ];

  headerRows.forEach(([label, value], index) => {
    const row = index + 3;
    sheet.cell(`A${row}`).value(label).style({ bold: true });
    sheet.cell(`B${row}`).value(value);
  });

  const tableHeaderRow = headerRows.length + 5;
  const headers = [
    "Vendedor",
    "Visita",
    "Relacionado",
    "Fecha visita",
    "Fecha gasto",
    "Tipo gasto",
    "Valor",
    "Descripcion",
    "Observaciones",
    "Estado",
    "Obs. legalizacion",
    "Soporte",
  ];

  headers.forEach((header, index) => {
    sheet.cell(tableHeaderRow, index + 1).value(header).style({
      bold: true,
      fill: "D9EAF7",
    });
  });

  items.forEach((item, index) => {
    const row = tableHeaderRow + 1 + index;

    sheet.cell(`A${row}`).value(item.usuarioNombre ?? "Sin vendedor");
    sheet.cell(`B${row}`).value(item.visitaId);
    sheet.cell(`C${row}`).value(getRelacionadoLabel(item));
    sheet.cell(`D${row}`).value(formatDate(item.visitaFecha));
    sheet.cell(`E${row}`).value(formatDate(item.fecha));
    sheet.cell(`F${row}`).value(formatTipoGastoLabel(item.tipoGasto));
    sheet.cell(`G${row}`).value(item.valor).style({ numberFormat: '"$"#,##0' });
    sheet.cell(`H${row}`).value(item.descripcion);
    sheet.cell(`I${row}`).value(item.observaciones ?? "");
    sheet.cell(`J${row}`).value(formatEstadoLabel(item.legalizacionEstado));
    sheet.cell(`K${row}`).value(item.legalizacionObservaciones ?? "");
    sheet.cell(`L${row}`).value(item.soporte?.fileName ?? "Sin soporte");
  });

  const summaryRow = tableHeaderRow + items.length + 3;
  sheet.cell(`A${summaryRow}`).value("Resumen").style({ bold: true, fontSize: 12 });

  const summaryItems: Array<[string, string]> = [
    ["Peajes", formatMoney(summary.tipos[ViaticoTipoGasto.PEAJES])],
    ["Gasolina", formatMoney(summary.tipos[ViaticoTipoGasto.GASOLINA])],
    ["Estadia", formatMoney(summary.tipos[ViaticoTipoGasto.ESTADIA])],
    ["Alimentacion", formatMoney(summary.tipos[ViaticoTipoGasto.ALIMENTACION])],
    ["Pendientes", String(summary.estados[ContableLegalizacionViaticoEstado.PENDIENTE])],
    [
      "Legalizados",
      String(summary.estados[ContableLegalizacionViaticoEstado.LEGALIZADO]),
    ],
    ["Aprobados", String(summary.estados[ContableLegalizacionViaticoEstado.APROBADO])],
    ["Rechazados", String(summary.estados[ContableLegalizacionViaticoEstado.RECHAZADO])],
    ["Total general", formatMoney(summary.total)],
  ];

  summaryItems.forEach(([label, value], index) => {
    const row = summaryRow + 1 + index;
    sheet.cell(`A${row}`).value(label).style({ bold: true });
    sheet.cell(`B${row}`).value(value);
  });

  sheet.column("A").width(20);
  sheet.column("B").width(18);
  sheet.column("C").width(28);
  sheet.column("D").width(14);
  sheet.column("E").width(14);
  sheet.column("F").width(18);
  sheet.column("G").width(14);
  sheet.column("H").width(28);
  sheet.column("I").width(28);
  sheet.column("J").width(14);
  sheet.column("K").width(28);
  sheet.column("L").width(26);

  const buffer = (await workbook.outputAsync()) as Buffer;

  return {
    buffer,
    contentType: EXCEL_CONTENT_TYPE,
    fileName: buildExportFileName("xlsx"),
  };
}

export async function generateContableViaticosPdf(
  items: ContableLegalizacionViatico[],
  filters: {
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    q?: string;
    vendedorNombre?: string;
  }
): Promise<GeneratedContableViaticosExport> {
  const summary = buildSummary(items);
  const lines: string[] = [];

  lines.push("Legalizacion de Viaticos");
  lines.push(`Fecha exportacion: ${formatDate(new Date())}`);
  lines.push(`Filtros: ${buildFiltersLabel(filters)}`);
  lines.push(`Registros: ${items.length}`);
  lines.push(`Total general: ${formatMoney(summary.total)}`);
  lines.push("");
  lines.push("Resumen por tipo");
  lines.push(`Peajes: ${formatMoney(summary.tipos[ViaticoTipoGasto.PEAJES])}`);
  lines.push(
    `Gasolina: ${formatMoney(summary.tipos[ViaticoTipoGasto.GASOLINA])}`
  );
  lines.push(`Estadia: ${formatMoney(summary.tipos[ViaticoTipoGasto.ESTADIA])}`);
  lines.push(
    `Alimentacion: ${formatMoney(summary.tipos[ViaticoTipoGasto.ALIMENTACION])}`
  );
  lines.push("");
  lines.push("Detalle");

  if (items.length === 0) {
    lines.push("Sin registros para exportar.");
  } else {
    items.forEach((item, index) => {
      lines.push("");
      lines.push(
        `${index + 1}. ${item.usuarioNombre ?? "Sin vendedor"} | ${formatTipoGastoLabel(
          item.tipoGasto
        )} | ${formatMoney(item.valor)}`
      );
      lines.push(
        `Visita: ${item.visitaId} | Relacionado: ${getRelacionadoLabel(item)}`
      );
      lines.push(
        `Fecha visita: ${formatDate(item.visitaFecha)} | Fecha gasto: ${formatDate(
          item.fecha
        )}`
      );
      lines.push(`Estado: ${formatEstadoLabel(item.legalizacionEstado)}`);
      lines.push(`Descripcion: ${item.descripcion}`);
      lines.push(`Observaciones: ${item.observaciones ?? "Sin observaciones"}`);
      lines.push(
        `Obs. legalizacion: ${item.legalizacionObservaciones ?? "Sin observaciones contables"}`
      );
      lines.push(`Soporte: ${item.soporte?.fileName ?? "Sin soporte"}`);
    });
  }

  const wrappedLines = lines.flatMap(line => wrapLine(line, 92));
  const buffer = buildPdfDocument(wrappedLines);

  return {
    buffer,
    contentType: PDF_CONTENT_TYPE,
    fileName: buildExportFileName("pdf"),
  };
}
