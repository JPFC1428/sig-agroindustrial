import XlsxPopulate from "xlsx-populate";
import {
  ContableCarteraEstado,
  ContableLegalizacionViaticoEstado,
  ViaticoTipoGasto,
  type ContableReportesData,
  type ContableReporteEstadoFiltro,
} from "../client/src/lib/types.js";

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

type GeneratedContableReportesExport = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

type PdfPage = {
  contentObjectNumber: number;
  lines: string[];
  pageObjectNumber: number;
};

type ReportFilters = {
  estado?: ContableReporteEstadoFiltro;
  fechaDesde?: string;
  fechaHasta?: string;
  tercero?: string;
};

function sanitizeFileNameSegment(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "reportes";
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
  return `reportes-contables-${sanitizeFileNameSegment(
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

function formatEstadoLabel(estado?: ContableReporteEstadoFiltro) {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "parcial":
      return "Parcial";
    case "pagado":
      return "Pagado";
    case "vencida":
      return "Vencida";
    case "anulada":
      return "Anulada";
    case "legalizado":
      return "Legalizado";
    case "aprobado":
      return "Aprobado";
    case "rechazado":
      return "Rechazado";
    case "conciliado":
      return "Conciliado";
    case "no_conciliado":
      return "No conciliado";
    default:
      return "Todos";
  }
}

function formatCarteraEstadoLabel(estado: ContableCarteraEstado) {
  switch (estado) {
    case ContableCarteraEstado.PENDIENTE:
      return "Pendiente";
    case ContableCarteraEstado.PARCIAL:
      return "Parcial";
    case ContableCarteraEstado.PAGADO:
      return "Pagado";
    default:
      return estado;
  }
}

function formatLegalizacionEstadoLabel(estado: ContableLegalizacionViaticoEstado) {
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

function formatMetodoLabel(value: string) {
  switch (value) {
    case "efectivo":
      return "Efectivo";
    case "transferencia":
      return "Transferencia";
    case "cheque":
      return "Cheque";
    case "tarjeta":
      return "Tarjeta";
    case "otro":
      return "Otro";
    default:
      return value;
  }
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

function buildFiltersLabel(filters: ReportFilters) {
  const parts = [
    filters.tercero ? `Tercero: ${filters.tercero}` : "",
    filters.estado ? `Estado: ${formatEstadoLabel(filters.estado)}` : "",
    filters.fechaDesde ? `Desde: ${filters.fechaDesde}` : "",
    filters.fechaHasta ? `Hasta: ${filters.fechaHasta}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Sin filtros adicionales";
}

function buildSummaryRows(report: ContableReportesData) {
  return [
    ["Facturas de compra", formatMoney(report.resumen.totalFacturasCompra)],
    ["Egresos", formatMoney(report.resumen.totalEgresos)],
    ["Recibos de caja", formatMoney(report.resumen.totalRecibosCaja)],
    ["Saldo cartera proveedores", formatMoney(report.resumen.saldoCarteraProveedores)],
    ["Saldo cartera clientes", formatMoney(report.resumen.saldoCarteraClientes)],
    ["Viaticos", formatMoney(report.resumen.totalViaticos)],
    ["Ingresos bancarios", formatMoney(report.resumen.totalIngresosBancarios)],
    ["Egresos bancarios", formatMoney(report.resumen.totalEgresosBancarios)],
    ["Saldo sistema", formatMoney(report.resumen.saldoBancarioSistema)],
    ["Saldo conciliado", formatMoney(report.resumen.saldoConciliado)],
    ["Diferencia conciliacion", formatMoney(report.resumen.diferenciaConciliacion)],
  ] satisfies Array<[string, string]>;
}

async function writeSheet(
  workbook: any,
  sheetName: string,
  title: string,
  headers: string[],
  rows: string[][]
) {
  const sheet = workbook.addSheet(sheetName);
  sheet.cell("A1").value(title).style({ bold: true, fontSize: 16 });
  sheet.cell("A3").value("Fecha exportacion").style({ bold: true });
  sheet.cell("B3").value(formatDate(new Date()));

  headers.forEach((header, index) => {
    sheet.cell(5, index + 1).value(header).style({
      bold: true,
      fill: "D9EAF7",
    });
  });

  rows.forEach((row, rowIndex) => {
    row.forEach((value, cellIndex) => {
      sheet.cell(6 + rowIndex, cellIndex + 1).value(value);
    });
  });

  const maxColumns = headers.length;
  for (let index = 0; index < maxColumns; index += 1) {
    const columnLetter = String.fromCharCode(65 + index);
    sheet.column(columnLetter).width(20);
  }
}

export async function generateContableReportesExcel(
  report: ContableReportesData,
  filters: ReportFilters
): Promise<GeneratedContableReportesExport> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const summarySheet = workbook.sheet(0);
  summarySheet.name("Resumen");
  summarySheet.cell("A1").value("Reportes Contables").style({
    bold: true,
    fontSize: 16,
  });

  const headerRows: Array<[string, string]> = [
    ["Fecha exportacion", formatDate(new Date())],
    ["Filtros", buildFiltersLabel(filters)],
  ];

  headerRows.forEach(([label, value], index) => {
    const row = index + 3;
    summarySheet.cell(`A${row}`).value(label).style({ bold: true });
    summarySheet.cell(`B${row}`).value(value);
  });

  const summaryRows = buildSummaryRows(report);
  summarySheet.cell("A6").value("Resumen general").style({ bold: true, fontSize: 12 });
  summaryRows.forEach(([label, value], index) => {
    const row = 7 + index;
    summarySheet.cell(`A${row}`).value(label).style({ bold: true });
    summarySheet.cell(`B${row}`).value(value);
  });

  summarySheet.cell("D6").value("Conciliacion").style({ bold: true, fontSize: 12 });
  const conciliacionRows: Array<[string, string]> = [
    ["Movimientos conciliados", String(report.conciliacion.movimientosConciliados)],
    ["Movimientos pendientes", String(report.conciliacion.movimientosPendientes)],
    ["Total ingresos", formatMoney(report.conciliacion.totalIngresos)],
    ["Total egresos", formatMoney(report.conciliacion.totalEgresos)],
    ["Saldo sistema", formatMoney(report.conciliacion.saldoSistema)],
    ["Saldo conciliado", formatMoney(report.conciliacion.saldoConciliado)],
    ["Diferencia", formatMoney(report.conciliacion.diferencia)],
  ];

  conciliacionRows.forEach(([label, value], index) => {
    const row = 7 + index;
    summarySheet.cell(`D${row}`).value(label).style({ bold: true });
    summarySheet.cell(`E${row}`).value(value);
  });

  summarySheet.column("A").width(28);
  summarySheet.column("B").width(24);
  summarySheet.column("D").width(28);
  summarySheet.column("E").width(24);

  await writeSheet(
    workbook,
    "Facturas",
    "Facturas de Compra",
    ["Factura", "Proveedor", "Fecha", "Vencimiento", "Total", "Saldo", "Estado", "Soporte"],
    report.facturasCompra.map(item => [
      item.numeroFactura,
      item.terceroNombreRazonSocial,
      formatDate(item.fechaFactura),
      formatDate(item.fechaVencimiento),
      formatMoney(item.total),
      formatMoney(item.saldo),
      item.estado,
      item.soporteUrl ?? "Sin soporte",
    ])
  );

  await writeSheet(
    workbook,
    "Egresos",
    "Comprobantes de Egreso",
    ["Comprobante", "Proveedor", "Fecha", "Metodo", "Valor", "Soporte"],
    report.egresos.map(item => [
      item.numeroComprobante,
      item.terceroNombreRazonSocial,
      formatDate(item.fecha),
      formatMetodoLabel(item.metodoPago),
      formatMoney(item.valorTotal),
      item.soporteUrl ?? "Sin soporte",
    ])
  );

  await writeSheet(
    workbook,
    "Recibos",
    "Recibos de Caja",
    ["Recibo", "Cliente", "Fecha", "Metodo", "Valor", "Soporte"],
    report.recibosCaja.map(item => [
      item.numeroRecibo,
      item.terceroNombreRazonSocial,
      formatDate(item.fecha),
      formatMetodoLabel(item.metodoPago),
      formatMoney(item.valorTotal),
      item.soporteUrl ?? "Sin soporte",
    ])
  );

  await writeSheet(
    workbook,
    "Cartera Prov",
    "Cartera Proveedores",
    ["Proveedor", "Factura", "Fecha", "Vencimiento", "Total", "Pagado", "Saldo", "Estado"],
    report.carteraProveedores.map(item => [
      item.proveedorNombreRazonSocial,
      item.numeroFactura,
      formatDate(item.fechaFactura),
      formatDate(item.fechaVencimiento),
      formatMoney(item.total),
      formatMoney(item.valorPagado),
      formatMoney(item.saldo),
      `${formatCarteraEstadoLabel(item.estado)}${item.vencida ? " / Vencida" : ""}`,
    ])
  );

  await writeSheet(
    workbook,
    "Cartera Cli",
    "Cartera Clientes",
    ["Cliente", "Documento", "Ult. movimiento", "Total", "Recibido", "Saldo", "Estado"],
    report.carteraClientes.map(item => [
      item.clienteNombreRazonSocial,
      item.documentoReferencia ?? item.documentoId ?? "Sin referencia",
      formatDate(item.fechaUltimoMovimiento),
      formatMoney(item.total),
      formatMoney(item.valorRecibido),
      formatMoney(item.saldo),
      formatCarteraEstadoLabel(item.estado),
    ])
  );

  await writeSheet(
    workbook,
    "Viaticos",
    "Legalizacion de Viaticos",
    ["Vendedor", "Relacionado", "Fecha", "Tipo", "Valor", "Estado", "Soporte"],
    report.viaticos.map(item => [
      item.usuarioNombre ?? "Sin vendedor",
      item.relacionadoEmpresa
        ? `${item.relacionadoNombre ?? "Sin relacionado"} - ${item.relacionadoEmpresa}`
        : item.relacionadoNombre ?? "Sin relacionado",
      formatDate(item.fecha),
      formatTipoGastoLabel(item.tipoGasto),
      formatMoney(item.valor),
      formatLegalizacionEstadoLabel(item.legalizacionEstado),
      item.soporte?.fileName ?? "Sin soporte",
    ])
  );

  await writeSheet(
    workbook,
    "Mov Bancarios",
    "Movimientos Bancarios",
    ["Cuenta", "Fecha", "Tipo", "Referencia", "Tercero", "Valor", "Saldo acum.", "Conciliado"],
    report.movimientosBancarios.map(item => [
      [item.cuentaBancariaBanco, item.cuentaBancariaNombre, item.cuentaBancariaNumero]
        .filter(Boolean)
        .join(" - "),
      formatDate(item.fecha),
      item.tipo,
      item.referenciaNumero,
      item.terceroNombreRazonSocial,
      formatMoney(item.valor),
      formatMoney(item.saldoAcumulado),
      item.conciliado ? "Si" : "No",
    ])
  );

  const buffer = (await workbook.outputAsync()) as Buffer;

  return {
    buffer,
    contentType: EXCEL_CONTENT_TYPE,
    fileName: buildExportFileName("xlsx"),
  };
}

export async function generateContableReportesPdf(
  report: ContableReportesData,
  filters: ReportFilters
): Promise<GeneratedContableReportesExport> {
  const lines: string[] = [];

  lines.push("Reportes Contables");
  lines.push(`Fecha exportacion: ${formatDate(new Date())}`);
  lines.push(`Filtros: ${buildFiltersLabel(filters)}`);
  lines.push("");
  lines.push("Resumen general");
  buildSummaryRows(report).forEach(([label, value]) => {
    lines.push(`${label}: ${value}`);
  });
  lines.push("");
  lines.push("Conciliacion");
  lines.push(`Movimientos conciliados: ${report.conciliacion.movimientosConciliados}`);
  lines.push(`Movimientos pendientes: ${report.conciliacion.movimientosPendientes}`);
  lines.push(`Saldo sistema: ${formatMoney(report.conciliacion.saldoSistema)}`);
  lines.push(`Saldo conciliado: ${formatMoney(report.conciliacion.saldoConciliado)}`);
  lines.push(`Diferencia: ${formatMoney(report.conciliacion.diferencia)}`);

  const sections = [
    {
      title: "Facturas de Compra",
      rows: report.facturasCompra.map(item =>
        `${item.numeroFactura} | ${item.terceroNombreRazonSocial} | ${formatDate(
          item.fechaFactura
        )} | ${formatMoney(item.total)} | Saldo ${formatMoney(item.saldo)} | ${item.estado}`
      ),
    },
    {
      title: "Comprobantes de Egreso",
      rows: report.egresos.map(item =>
        `${item.numeroComprobante} | ${item.terceroNombreRazonSocial} | ${formatDate(
          item.fecha
        )} | ${formatMoney(item.valorTotal)} | ${formatMetodoLabel(item.metodoPago)}`
      ),
    },
    {
      title: "Recibos de Caja",
      rows: report.recibosCaja.map(item =>
        `${item.numeroRecibo} | ${item.terceroNombreRazonSocial} | ${formatDate(
          item.fecha
        )} | ${formatMoney(item.valorTotal)} | ${formatMetodoLabel(item.metodoPago)}`
      ),
    },
    {
      title: "Cartera Proveedores",
      rows: report.carteraProveedores.map(item =>
        `${item.proveedorNombreRazonSocial} | ${item.numeroFactura} | Saldo ${formatMoney(
          item.saldo
        )} | ${formatCarteraEstadoLabel(item.estado)}${item.vencida ? " / Vencida" : ""}`
      ),
    },
    {
      title: "Cartera Clientes",
      rows: report.carteraClientes.map(item =>
        `${item.clienteNombreRazonSocial} | ${
          item.documentoReferencia ?? item.documentoId ?? "Sin referencia"
        } | Saldo ${formatMoney(item.saldo)} | ${formatCarteraEstadoLabel(item.estado)}`
      ),
    },
    {
      title: "Legalizacion de Viaticos",
      rows: report.viaticos.map(item =>
        `${item.usuarioNombre ?? "Sin vendedor"} | ${formatTipoGastoLabel(
          item.tipoGasto
        )} | ${formatMoney(item.valor)} | ${formatLegalizacionEstadoLabel(
          item.legalizacionEstado
        )} | ${item.soporte?.fileName ?? "Sin soporte"}`
      ),
    },
    {
      title: "Movimientos Bancarios",
      rows: report.movimientosBancarios.map(item =>
        `${[item.cuentaBancariaBanco, item.cuentaBancariaNombre, item.cuentaBancariaNumero]
          .filter(Boolean)
          .join(" - ")} | ${formatDate(item.fecha)} | ${item.tipo} | ${
          item.referenciaNumero
        } | ${formatMoney(item.valor)} | ${
          item.conciliado ? "Conciliado" : "No conciliado"
        }`
      ),
    },
  ];

  sections.forEach(section => {
    lines.push("");
    lines.push(section.title);
    if (section.rows.length === 0) {
      lines.push("Sin registros.");
      return;
    }

    section.rows.forEach(row => lines.push(row));
  });

  const wrappedLines = lines.flatMap(line => wrapLine(line, 92));
  const buffer = buildPdfDocument(wrappedLines);

  return {
    buffer,
    contentType: PDF_CONTENT_TYPE,
    fileName: buildExportFileName("pdf"),
  };
}
