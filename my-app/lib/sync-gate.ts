// Lets sign-out wait for in-flight cart syncs and block new ones. Needed
// because Auth.js re-sets the session cookie on any request that calls auth():
// a cart Server Action finishing after sign-out would sign the user back in.

export type SyncGate = {
  /** Runs `task` unless the gate is closed; tracks it until it settles. */
  run(task: () => Promise<void>): Promise<void>;
  /** Stops new tasks and resolves once every in-flight task has settled. */
  close(): Promise<void>;
  isClosed(): boolean;
};

export function createSyncGate(): SyncGate {
  let closed = false;
  const inFlight = new Set<Promise<void>>();

  return {
    run(task) {
      if (closed) return Promise.resolve();
      const promise = task();
      const tracked = promise.then(
        () => {},
        () => {},
      );
      inFlight.add(tracked);
      void tracked.then(() => inFlight.delete(tracked));
      return promise;
    },
    async close() {
      closed = true;
      await Promise.all(inFlight);
    },
    isClosed: () => closed,
  };
}
