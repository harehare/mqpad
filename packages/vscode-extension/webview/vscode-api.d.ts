import type { VsCodeApi } from "mqpad-app";

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}
