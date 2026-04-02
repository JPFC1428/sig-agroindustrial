import fs from "node:fs";
import path from "node:path";
import XlsxPopulate from "xlsx-populate";
import type { Cotizacion } from "../client/src/lib/types.js";
import {
  COTIZACION_EXCEL_TEMPLATE_MAPPING,
  type CotizacionExcelCellMapping,
  type CotizacionExcelItemColumnMapping,
  resolveCotizacionTemplatePath,
} from "./cotizaciones-excel-template.js";

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type CotizacionExcelSource = Omit<Cotizacion, "fecha" | "fechaVencimiento"> & {
  fecha: Date | string;
  fechaVencimiento: Date | string;
};

type TemplateCell = {
  value(value: unknown): unknown;
  formula?: (() => string | undefined) | string | undefined;
};

type TemplateSheet = {
  cell(address: string): TemplateCell;
  name(): string;
};

type WorkbookSheetRef = {
  name(): string;
};

type TemplateWorkbook = {
  sheet(nameOrIndex: string | number): TemplateSheet | undefined;
  sheets(): WorkbookSheetRef[];
  outputAsync(opts?: unknown): Promise<Buffer | Uint8Array | ArrayBuffer>;
};

type ClienteExcelDetails = {
  nit?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  nombre?: string | null;
  contactoPrincipal?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
};

type GeneratedCotizacionExcel = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  templatePath: string;
  sheetName: string;
};

function sanitizeFileNameSegment(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "cotizacion";
}

function buildOutputFileName(cotizacion: CotizacionExcelSource) {
  const numero = sanitizeFileNameSegment(cotizacion.numero);
  const cliente = sanitizeFileNameSegment(
    cotizacion.clienteEmpresa ?? cotizacion.clienteNombre ?? "cliente"
  );

  return `${numero}-${cliente}.xlsx`;
}

function readOptionalText(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  return text.length > 0 ? text : "";
}

function getClienteLabel(
  cotizacion: CotizacionExcelSource,
  cliente?: ClienteExcelDetails
) {
  const nombre = readOptionalText(cliente?.nombre || cotizacion.clienteNombre);
  const empresa = readOptionalText(
    cliente?.empresa || cotizacion.clienteEmpresa
  );

  if (nombre && empresa) {
    return `${nombre} - ${empresa}`;
  }

  return empresa || nombre || "Cliente sin nombre";
}

function getContactoLabel(
  cotizacion: CotizacionExcelSource,
  cliente?: ClienteExcelDetails
) {
  return readOptionalText(
    cliente?.contactoPrincipal || cliente?.nombre || cotizacion.clienteNombre
  );
}

function ensureTemplateExists(templatePath: string) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `No se encontro la plantilla Excel en ${templatePath}. Coloca la plantilla original .xlsx o configura COTIZACION_TEMPLATE_PATH.`
    );
  }
}

function normalizeSheetName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveTemplateSheet(workbook: TemplateWorkbook) {
  const configuredName = COTIZACION_EXCEL_TEMPLATE_MAPPING.sheetName;
  const sheetNames = workbook.sheets().map(sheet => sheet.name());

  const exactMatch =
    workbook.sheet(configuredName) ??
    workbook.sheet("Cotización") ??
    workbook.sheet("Cotizacion");

  if (exactMatch) {
    return exactMatch;
  }

  const targetNames = [
    configuredName,
    "Cotización",
    "Cotizacion",
    "cotización",
    "cotizacion",
  ].map(normalizeSheetName);

  const normalizedMatch = sheetNames.find(sheetName =>
    targetNames.includes(normalizeSheetName(sheetName))
  );

  if (normalizedMatch) {
    const sheet = workbook.sheet(normalizedMatch);

    if (sheet) {
      return sheet;
    }
  }

  return workbook.sheet(0);
}

function getFormula(cell: TemplateCell) {
  if (typeof cell.formula === "function") {
    return cell.formula();
  }

  return typeof cell.formula === "string" ? cell.formula : undefined;
}

function setCellValue(
  sheet: TemplateSheet,
  mapping: CotizacionExcelCellMapping,
  value: unknown
) {
  const cell = sheet.cell(mapping.address);

  if (mapping.preserveFormula && getFormula(cell)) {
    return;
  }

  cell.value(value);
}

function setColumnValue(
  sheet: TemplateSheet,
  row: number,
  mapping: CotizacionExcelItemColumnMapping,
  value: unknown
) {
  const cell = sheet.cell(`${mapping.column}${row}`);

  if (mapping.preserveFormula && getFormula(cell)) {
    return;
  }

  cell.value(value);
}

function fillItems(sheet: TemplateSheet, cotizacion: CotizacionExcelSource) {
  const itemMapping = COTIZACION_EXCEL_TEMPLATE_MAPPING.items;

  if (cotizacion.lineas.length > itemMapping.maxRows) {
    throw new Error(
      `La plantilla soporta ${itemMapping.maxRows} item(s) y la cotizacion tiene ${cotizacion.lineas.length}. Ajusta el mapeo o la plantilla.`
    );
  }

  for (let index = 0; index < itemMapping.maxRows; index += 1) {
    const rowNumber = itemMapping.startRow + index;
    const linea = cotizacion.lineas[index];
    const unitPrice =
      linea && linea.descuento > 0
        ? Number(
            (
              linea.precioUnitario *
              (1 - linea.descuento / 100)
            ).toFixed(2)
          )
        : linea?.precioUnitario ?? "";

    if (itemMapping.columns.item) {
      setColumnValue(
        sheet,
        rowNumber,
        itemMapping.columns.item,
        linea ? index + 1 : ""
      );
    }

    if (itemMapping.columns.referencia) {
      setColumnValue(
        sheet,
        rowNumber,
        itemMapping.columns.referencia,
        ""
      );
    }

    setColumnValue(sheet, rowNumber, itemMapping.columns.descripcion, linea?.descripcion ?? "");
    setColumnValue(
      sheet,
      rowNumber,
      itemMapping.columns.cantidad,
      linea?.cantidad ?? ""
    );
    if (itemMapping.columns.unidad) {
      setColumnValue(sheet, rowNumber, itemMapping.columns.unidad, "");
    }
    setColumnValue(
      sheet,
      rowNumber,
      itemMapping.columns.precioUnitario,
      unitPrice
    );
    setColumnValue(
      sheet,
      rowNumber,
      itemMapping.columns.subtotal,
      linea?.subtotal ?? ""
    );
  }
}

function normalizeBuffer(data: Buffer | Uint8Array | ArrayBuffer) {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  return Buffer.from(data);
}

export async function generateCotizacionExcel(
  cotizacion: CotizacionExcelSource,
  cliente?: ClienteExcelDetails
): Promise<GeneratedCotizacionExcel> {
  const templatePath = resolveCotizacionTemplatePath();
  ensureTemplateExists(templatePath);

  const workbook = (await XlsxPopulate.fromFileAsync(
    templatePath
  )) as TemplateWorkbook;
  const sheet = resolveTemplateSheet(workbook);

  if (!sheet) {
    throw new Error(
      `No se encontro la hoja "${COTIZACION_EXCEL_TEMPLATE_MAPPING.sheetName}" en la plantilla ${path.basename(
        templatePath
      )}.`
    );
  }

  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.nit!,
    readOptionalText(cliente?.nit)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.telefono!,
    readOptionalText(cliente?.telefono)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.cliente,
    getClienteLabel(cotizacion, cliente)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.contacto!,
    getContactoLabel(cotizacion, cliente)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.email!,
    readOptionalText(cliente?.email)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.fecha,
    new Date(cotizacion.fecha)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.direccion!,
    readOptionalText(cliente?.direccion)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.ciudad!,
    readOptionalText(cliente?.ciudad)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.condicionesPago!,
    readOptionalText(cotizacion.condicionesPago)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.importe!,
    cotizacion.subtotal
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.descuento!,
    cotizacion.descuentoGlobal ?? 0
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.subtotal,
    cotizacion.subtotal - (cotizacion.descuentoGlobal ?? 0)
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.impuesto!,
    cotizacion.impuesto
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.total,
    cotizacion.total
  );
  setCellValue(
    sheet,
    COTIZACION_EXCEL_TEMPLATE_MAPPING.cells.observaciones,
    cotizacion.notas ?? ""
  );

  fillItems(sheet, cotizacion);

  const output = await workbook.outputAsync({ type: "nodebuffer" });

  return {
    buffer: normalizeBuffer(output),
    contentType: EXCEL_CONTENT_TYPE,
    fileName: buildOutputFileName(cotizacion),
    templatePath,
    sheetName: sheet.name(),
  };
}
