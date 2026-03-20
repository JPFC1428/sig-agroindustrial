import type { IncomingMessage, ServerResponse } from "node:http";
import { handleClientesCollection } from "../../server/clientes-api";

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  await handleClientesCollection(req, res);
}
