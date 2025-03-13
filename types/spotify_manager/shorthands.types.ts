import type { RawAxiosRequestHeaders } from "axios";
import type { Request, Response, NextFunction } from "express";

export type Req = Request;
export type Res = Response;
export type Next = NextFunction;

export interface EndpointHandlerBaseArgs {
  authHeaders: RawAxiosRequestHeaders;
}
export interface EndpointHandlerWithResArgs extends EndpointHandlerBaseArgs {
  res: Res;
}
