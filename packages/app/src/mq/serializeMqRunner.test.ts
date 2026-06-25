import { describe, expect, it } from "vitest";
import { serializeMqRunner } from "./serializeMqRunner";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("serializeMqRunner", () => {
  it("runs calls one at a time, in order", async () => {
    const order: string[] = [];
    const first = deferred<string>();
    let secondStarted = false;

    const runner = serializeMqRunner(async (query) => {
      order.push(`start:${query}`);
      if (query === "first") {
        await first.promise;
      } else {
        secondStarted = true;
      }
      order.push(`end:${query}`);
      return query;
    });

    const firstCall = runner.run("first", "");
    const secondCall = runner.run("second", "");

    // The second call must not start until the first one resolves.
    await new Promise((r) => setTimeout(r, 10));
    expect(secondStarted).toBe(false);

    first.resolve("done");
    await Promise.all([firstCall, secondCall]);

    expect(order).toEqual(["start:first", "end:first", "start:second", "end:second"]);
  });

  it("still runs the next call after a previous one rejects", async () => {
    const runner = serializeMqRunner(async (query) => {
      if (query === "boom") throw new Error("boom");
      return query;
    });

    await expect(runner.run("boom", "")).rejects.toThrow("boom");
    await expect(runner.run("ok", "")).resolves.toBe("ok");
  });
});
