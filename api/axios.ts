// TODO: rate limit module is busted (CJS types), do something for rate limiting
// bottleneck (https://npmjs.com/package/bottleneck) looks nice
import axios from "axios";
import type { AxiosInstance } from "axios";
import { baseAPIURL, accountsAPIURL } from "../constants.ts";
import logger from "../utils/logger.ts";

const authInstance: AxiosInstance = axios.create({
  baseURL: accountsAPIURL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " +
      Buffer.from(
        process.env["SPOTMGR_CLIENT_ID"] + ":" + process.env["SPOTMGR_CLIENT_SECRET"]
      ).toString("base64"),
  },
});

const axiosInstance: AxiosInstance = axios.create({
  baseURL: baseAPIURL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  logger.http("API call", {
    url: config.url,
    method: config.method,
    params: config.params ?? {},
    headers: Object.keys(config.headers),
  });
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.warn("AxiosError", {
      error: {
        name: error.name,
        code: error.code,
        message: error.message,
      },
      req: error.config,
    });
    return Promise.reject(error);
  }
);

export { authInstance, axiosInstance };
