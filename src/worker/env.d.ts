declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    ROOM: DurableObjectNamespace<import("./room-do").RoomDO>;
  }
}
