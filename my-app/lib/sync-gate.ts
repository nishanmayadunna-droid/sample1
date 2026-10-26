// Lets sign-out wait for in-flight cart syncs and block new ones. Auth.js's
// proxy.ts wrapper re-sets the session cookie on every request it handles, so a
// cart Server Action that went through it and finished after sign-out signed
// the user back in. proxy.ts now skips Server Actions; this is defence in depth
// (it also keeps a sync from starting mid sign-out).

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
