import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuthorizedApiRequest } from "../server/auth-api.js";
import { handleDashboardSummary } from "./dashboard/_dashboard-api.js";
import {
  getSertecIdFromRequestUrl,
  handleSertecCollection,
  handleSertecItem,
} from "../server/sertec-api.js";
import {
  getContableTerceroIdFromRequestUrl,
  handleContableTerceroItem,
  handleContableTercerosCollection,
} from "../server/contable-terceros-api.js";
import {
  getFacturaCompraIdFromRequestUrl,
  handleFacturaCompraItem,
  handleFacturasCompraCollection,
} from "../server/contable-facturas-compra-api.js";
import {
  getContableNotaCreditoIdFromRequestUrl,
  handleContableNotaCreditoItem,
  handleContableNotasCreditoCollection,
} from "../server/contable-notas-credito-api.js";
import { handleContableCuadresCajaCollection } from "../server/contable-cuadres-caja-api.js";
import { handleContableNominaCollection } from "../server/contable-nomina-api.js";
import {
  getEgresoIdFromRequestUrl,
  handleEgresoItem,
  handleEgresosCollection,
} from "../server/contable-egresos-api.js";
import {
  getReciboCajaIdFromRequestUrl,
  handleReciboCajaItem,
  handleRecibosCajaCollection,
} from "../server/contable-recibos-caja-api.js";
import {
  handleCarteraClientesCollection,
  handleCarteraProveedoresCollection,
} from "../server/contable-cartera-api.js";
import {
  getContableCuentaBancariaIdFromRequestUrl,
  handleContableBancoItem,
  handleContableBancosCollection,
} from "../server/contable-bancos-api.js";
import {
  getContableViaticoIdFromRequestUrl,
  handleContableViaticosCollection,
  handleContableViaticoItem,
} from "../server/contable-viaticos-api.js";
import { handleContableArchivoCollection } from "../server/contable-archivo-api.js";
import { handleContableReportesCollection } from "../server/contable-reportes-api.js";
import { handleUsersCollection } from "../server/users-api.js";

export const config = {
  runtime: "nodejs",
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export default async function handler(
  request: NodeRequest,
  response: ServerResponse
) {
  try {
    const pathname = getPathname(request.url);

    if (pathname === "/api/users" || pathname === "/api/users/") {
      await handleUsersCollection(request, response);
      return;
    }

    if (pathname === "/api/dashboard" || pathname === "/api/dashboard/") {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleDashboardSummary(request, response);
      return;
    }

    if (pathname === "/api/sertec" || pathname === "/api/sertec/") {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleSertecCollection(request, response);
      return;
    }

    const sertecId = getSertecIdFromRequestUrl(request.url);

    if (sertecId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleSertecItem(request, response, sertecId);
      return;
    }

    if (
      pathname === "/api/contable/terceros" ||
      pathname === "/api/contable/terceros/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableTercerosCollection(request, response);
      return;
    }

    const contableTerceroId = getContableTerceroIdFromRequestUrl(request.url);

    if (contableTerceroId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableTerceroItem(request, response, contableTerceroId);
      return;
    }

    if (
      pathname === "/api/contable/facturas-compra" ||
      pathname === "/api/contable/facturas-compra/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleFacturasCompraCollection(request, response);
      return;
    }

    const facturaCompraId = getFacturaCompraIdFromRequestUrl(request.url);

    if (facturaCompraId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleFacturaCompraItem(request, response, facturaCompraId);
      return;
    }

    if (
      pathname === "/api/contable/notas-credito" ||
      pathname === "/api/contable/notas-credito/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableNotasCreditoCollection(request, response);
      return;
    }

    const notaCreditoId = getContableNotaCreditoIdFromRequestUrl(request.url);

    if (notaCreditoId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableNotaCreditoItem(request, response, notaCreditoId);
      return;
    }

    if (
      pathname === "/api/contable/cuadres-caja" ||
      pathname === "/api/contable/cuadres-caja/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableCuadresCajaCollection(request, response);
      return;
    }

    if (pathname === "/api/contable/nomina" || pathname === "/api/contable/nomina/") {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableNominaCollection(request, response);
      return;
    }

    if (pathname === "/api/contable/egresos" || pathname === "/api/contable/egresos/") {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleEgresosCollection(request, response);
      return;
    }

    const egresoId = getEgresoIdFromRequestUrl(request.url);

    if (egresoId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleEgresoItem(request, response, egresoId);
      return;
    }

    if (
      pathname === "/api/contable/recibos-caja" ||
      pathname === "/api/contable/recibos-caja/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleRecibosCajaCollection(request, response);
      return;
    }

    const reciboCajaId = getReciboCajaIdFromRequestUrl(request.url);

    if (reciboCajaId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleReciboCajaItem(request, response, reciboCajaId);
      return;
    }

    if (
      pathname === "/api/contable/cartera-proveedores" ||
      pathname === "/api/contable/cartera-proveedores/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleCarteraProveedoresCollection(request, response);
      return;
    }

    if (
      pathname === "/api/contable/cartera-clientes" ||
      pathname === "/api/contable/cartera-clientes/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleCarteraClientesCollection(request, response);
      return;
    }

    if (
      pathname === "/api/contable/reportes" ||
      pathname === "/api/contable/reportes/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableReportesCollection(request, response);
      return;
    }

    if (
      pathname === "/api/contable/archivo" ||
      pathname === "/api/contable/archivo/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableArchivoCollection(request, response);
      return;
    }

    if (
      pathname === "/api/contable/bancos" ||
      pathname === "/api/contable/bancos/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableBancosCollection(request, response);
      return;
    }

    const cuentaBancariaId = getContableCuentaBancariaIdFromRequestUrl(request.url);

    if (cuentaBancariaId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableBancoItem(request, response, cuentaBancariaId);
      return;
    }

    if (
      pathname === "/api/contable/viaticos" ||
      pathname === "/api/contable/viaticos/"
    ) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableViaticosCollection(request, response);
      return;
    }

    const contableViaticoId = getContableViaticoIdFromRequestUrl(request.url);

    if (contableViaticoId) {
      const authenticatedUser = await requireAuthorizedApiRequest(
        request,
        response,
        pathname
      );

      if (!authenticatedUser) {
        return;
      }

      await handleContableViaticoItem(request, response, contableViaticoId);
      return;
    }

    if (!response.headersSent) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          detail: `No existe la ruta ${pathname}`,
          error: "Ruta no encontrada",
        })
      );
      return;
    }

    response.end();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({ error: "Error interno en /api", detail })
      );
      return;
    }

    response.end();
  }
}
