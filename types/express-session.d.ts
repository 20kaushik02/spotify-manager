import type { RawAxiosRequestHeaders } from "axios";
import type { User } from "spotify_manager/index.d.ts";

declare module "express-session" {
  // added properties
  interface SessionData {
    accessToken: string;
    refreshToken: string;
    authHeaders: RawAxiosRequestHeaders;
    user: User;
  }
}

export {};
