export const config = {
  runtime: "nodejs",
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1] ?? "";

  return new Response(
    JSON.stringify({
      ok: true,
      route: "/api/prospectos/[id]",
      id,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
