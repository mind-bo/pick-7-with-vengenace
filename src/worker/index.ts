import { DurableObject } from "cloudflare:workers";

export class RoomDO extends DurableObject {}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
