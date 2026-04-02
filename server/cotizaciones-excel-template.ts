import path from "node:path";

export type CotizacionExcelCellMapping = {
  address: string;
  preserveFormula?: boolean;
};

export type CotizacionExcelItemColumnMapping = {
  column: string;
  preserveFormula?: boolean;
};

export type CotizacionExcelTemplateMapping = {
  sheetName: string;
  cells: {
    nit?: CotizacionExcelCellMapping;
    telefono?: CotizacionExcelCellMapping;
    cliente: CotizacionExcelCellMapping;
    contacto?: CotizacionExcelCellMapping;
    email?: CotizacionExcelCellMapping;
    fecha: CotizacionExcelCellMapping;
    direccion?: CotizacionExcelCellMapping;
    ciudad?: CotizacionExcelCellMapping;
    condicionesPago?: CotizacionExcelCellMapping;
    importe?: CotizacionExcelCellMapping;
    descuento?: CotizacionExcelCellMapping;
    subtotal: CotizacionExcelCellMapping;
    impuesto?: CotizacionExcelCellMapping;
    total: CotizacionExcelCellMapping;
    observaciones: CotizacionExcelCellMapping;
  };
  items: {
    startRow: number;
    maxRows: number;
    columns: {
      item?: CotizacionExcelItemColumnMapping;
      referencia?: CotizacionExcelItemColumnMapping;
      descripcion: CotizacionExcelItemColumnMapping;
      cantidad: CotizacionExcelItemColumnMapping;
      unidad?: CotizacionExcelItemColumnMapping;
      precioUnitario: CotizacionExcelItemColumnMapping;
      subtotal: CotizacionExcelItemColumnMapping;
    };
  };
};

const DEFAULT_TEMPLATE_RELATIVE_PATH = path.join(
  "templates",
  "cotizaciones",
  "plantilla-cotizacion.xlsx"
);

export const COTIZACION_EXCEL_TEMPLATE_MAPPING: CotizacionExcelTemplateMapping =
  {
    sheetName: process.env.COTIZACION_TEMPLATE_SHEET?.trim() || "Cotización",
    cells: {
      nit: { address: "B12" },
      telefono: { address: "B14" },
      cliente: { address: "E12" },
      contacto: { address: "N12" },
      email: { address: "N14" },
      fecha: { address: "V12" },
      direccion: { address: "E14" },
      ciudad: { address: "Z12" },
      condicionesPago: { address: "Z14" },
      importe: { address: "Z42" },
      descuento: { address: "Z43" },
      subtotal: { address: "Z44" },
      impuesto: { address: "Z45" },
      total: { address: "Z46" },
      observaciones: { address: "D8" },
    },
    items: {
      startRow: 17,
      maxRows: 25,
      columns: {
        item: { column: "B" },
        referencia: { column: "D" },
        descripcion: { column: "G" },
        cantidad: { column: "P" },
        unidad: { column: "S" },
        precioUnitario: { column: "V" },
        subtotal: { column: "Z", preserveFormula: true },
      },
    },
  };

export function resolveCotizacionTemplatePath() {
  const configuredPath = process.env.COTIZACION_TEMPLATE_PATH?.trim();

  if (!configuredPath) {
    return path.resolve(process.cwd(), DEFAULT_TEMPLATE_RELATIVE_PATH);
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}
