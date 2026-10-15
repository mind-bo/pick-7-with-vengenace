import { generateCode } from "./room";

export { RoomDO } from "./room-do";

const MAX_CODE_TRIES = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function createRoom(req: Request, env: Cloudflare.Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  for (let i = 0; i < MAX_CODE_TRIES; i++) {
    const code = generateCode();
    const result = await env.ROOM.get(env.ROOM.idFromName(code)).create(code, name);
    if ("token" in result) return json({ code, token: result.token });
    if (result.error === "BAD_NAME") return json({ error: "BAD_NAME" }, 400);
  }
  return json({ error: "CODE_TAKEN" }, 503);
}

export default {
  async fetch(req: Request, env: Cloudflare.Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/api/rooms") return createRoom(req, env);
    const ws = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (ws) {
      const code = ws[1]!.toUpperCase();
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Cloudflare.Env>;
