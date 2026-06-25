import type { MqRunner } from "./MqRunnerContext";

/**
 * mq-web's wasm module is a single instance shared by the whole page. When
 * two `run()` calls overlap (e.g. several mq code blocks each auto-evaluate
 * on load), the underlying wasm-bindgen glue can throw "closure invoked
 * recursively or after being dropped" - it isn't safe for concurrent calls.
 * This wraps a raw run function so calls queue up one at a time instead.
 */
export function serializeMqRunner(run: MqRunner["run"]): MqRunner {
  let queue: Promise<unknown> = Promise.resolve();

  return {
    run(query: string, content: string): Promise<string> {
      const result = queue.then(() => run(query, content));
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
