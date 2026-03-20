import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getClienteIdFromRequestUrl,
  handleClienteItem,
} from "../../server/clientes-api";

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  const id = getClienteIdFromRequestUrl(req.url);

  if (!id) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Cliente invalido" }));
    return;
  }

  await handleClienteItem(req, res, id);
}
