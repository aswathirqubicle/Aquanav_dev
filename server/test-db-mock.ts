/**
 * Shared Drizzle query-builder mock for unit tests.
 *
 * WHY THIS EXISTS
 * The two unit-test suites each hand-rolled their own `jest.mock('./db', ...)`
 * stub listing a fixed set of chain methods. The storage layer has since grown
 * chains those stubs never covered — `.leftJoin()`, `.orderBy()`, `.offset()`,
 * `db.transaction()` — so every affected test died with
 * "…leftJoin is not a function" rather than a real assertion failure. Because
 * the suites had never been runnable, nothing caught the drift.
 *
 * DESIGN
 * The mock is deliberately FLAT: every method lives directly on `db` and
 * returns `this`, so `db.select().from().where()` walks the same object. That
 * matters because the tests assert against the chained methods by name —
 * `expect(db.from)`, `expect(db.set)`, `expect(db.values)`, `expect(db.where)`.
 * A nested per-call chain factory would break those assertions.
 *
 * Individual tests still override a specific call with
 * `(db.select as jest.Mock).mockImplementationOnce(() => ({ ... }))` to supply
 * terminal data. `mockImplementationOnce` is consumed after one call and falls
 * back to the chaining behaviour here, so that convention keeps working.
 *
 * Kept in step with the query methods used across server/storage/*.ts.
 */

/** Every builder method the storage layer chains. */
const CHAIN_METHODS = [
  // read
  "select",
  "selectDistinct",
  "from",
  "where",
  "limit",
  "offset",
  "orderBy",
  "groupBy",
  "having",
  "leftJoin",
  "innerJoin",
  "rightJoin",
  "fullJoin",
  // write
  "insert",
  "values",
  "returning",
  "onConflictDoNothing",
  "onConflictDoUpdate",
  "update",
  "set",
  "delete",
] as const;

export type MockDb = Record<string, any>;

export const createDbMock = (): { db: MockDb } => {
  /** FIFO of values that successive awaited chains resolve to. */
  const queue: unknown[] = [];
  const nextResult = () => (queue.length > 0 ? queue.shift() : []);

  const db: MockDb = {};

  for (const method of CHAIN_METHODS) {
    // mockReturnThis keeps the chain walking the same object, so both
    // `db.select().from()` and a later `expect(db.from)` refer to one instance.
    db[method] = jest.fn().mockReturnThis();
  }

  // Terminal: `.execute()` ends a chain and is awaited.
  db.execute = jest.fn(() => Promise.resolve(nextResult()));

  // `db.transaction(cb)` must actually invoke its callback, or code under test
  // silently does nothing. The callback receives the same flat mock, so
  // `tx.insert(...)` is assertable as `db.insert`.
  db.transaction = jest.fn(async (callback: (tx: MockDb) => unknown) =>
    callback(db),
  );

  // Making the mock itself thenable is what lets a test assert on the chained
  // methods. The previous approach — overriding `db.select` with a bespoke
  // nested stub — meant the real `db.from` was never invoked, so assertions
  // like `expect(db.from).toHaveBeenCalledWith(inventoryItems)` could never
  // pass no matter how the chain was shaped. Awaiting any chain now yields the
  // next queued result, and every link in that chain is a real, assertable
  // jest.fn on `db`.
  db.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(nextResult()).then(resolve, reject);

  /** Queue the value the next awaited chain resolves to. Chainable. */
  db.__queueResult = (value: unknown) => {
    queue.push(value);
    return db;
  };

  /** Queue several results in the order the code under test will consume them. */
  db.__queueResults = (...values: unknown[]) => {
    queue.push(...values);
    return db;
  };

  /** Drop any unconsumed results. Call between tests. */
  db.__resetQueue = () => {
    queue.length = 0;
    return db;
  };

  /** How many queued results were not consumed - useful to assert intent. */
  db.__pendingResults = () => queue.length;

  return { db };
};
