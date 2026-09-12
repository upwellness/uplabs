/**
 * Backup / restore decisions: FK-safe order, snapshot parsing (v2 + legacy), restore
 * planning against the live catalog, column projection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTables, parseSnapshot, planRestore, projectRow, snapshotFilename, type CatalogEntry } from "../lib/backup/snapshot.ts";

const cat = (name: string, parents: string[] = [], pk: string[] = ["id"], columns = ["id", "customer_id", "value"]): CatalogEntry =>
  ({ table_name: name, est_rows: 0, pk_columns: pk, fk_parents: parents, columns });
const CATALOG: CatalogEntry[] = [
  cat("customer_lab_values", ["customer_records", "customers"]),
  cat("customer_records", ["customers"]),
  cat("customers", [], ["id"], ["id", "name", "gender"]),
  cat("profiles", []),
  cat("customer_assignments", ["customers"], ["customer_id", "user_id"], ["customer_id", "user_id"]),
  cat("legacy_no_pk", [], [], ["a", "b"]),
  cat("a_cycle", ["b_cycle"]), cat("b_cycle", ["a_cycle"]),
];

test("orderTables puts every parent before its children and tolerates cycles", () => {
  const order = orderTables(CATALOG);
  const pos = (t: string) => order.indexOf(t);
  assert.ok(pos("customers") < pos("customer_records"));
  assert.ok(pos("customer_records") < pos("customer_lab_values"));
  assert.ok(pos("customers") < pos("customer_assignments"));
  assert.equal(order.length, CATALOG.length);
  assert.ok(pos("a_cycle") >= 0 && pos("b_cycle") >= 0);
});

test("parseSnapshot: v2 and legacy files both normalise; garbage is refused", () => {
  const v2 = parseSnapshot({ format: "uplabs-snapshot", version: 2, created_at: "2026-09-13T00:00:00.000Z", created_by: "x", order: ["customers"], tables: { customers: { pk: ["id"], row_count: 1, rows: [{ id: "1", name: "n" }] } } });
  assert.ok(v2.ok); assert.equal(v2.legacy, false); assert.equal(v2.snapshot.totals.rows, 1); assert.deepEqual(v2.snapshot.tables.customers.pk, ["id"]);
  const v1 = parseSnapshot({ _meta: { created_at: "2026-01-01" }, tables: { customers: { row_count: 2, rows: [{ id: "1" }, { id: "2" }] } } });
  assert.ok(v1.ok); assert.equal(v1.legacy, true); assert.equal(v1.snapshot.version, 1); assert.deepEqual(v1.snapshot.tables.customers.pk, []);
  assert.equal(parseSnapshot({ hello: 1 }).ok, false);
  assert.equal(parseSnapshot({ tables: { "bad name; drop": { rows: [] } } }).ok, false);
  assert.equal(parseSnapshot({ tables: { customers: { rows: [1, 2] } } }).ok, false);
});

test("planRestore: live catalog decides pk/order; missing tables and empty tables are skipped with a reason", () => {
  const snap = parseSnapshot({ format: "uplabs-snapshot", tables: {
    customer_lab_values: { rows: [{ id: "v1", customer_id: "c1", value: "5", removed_col: 1 }] },
    customers: { rows: [{ id: "c1", name: "A" }] },
    customer_records: { rows: [] },
    legacy_no_pk: { rows: [{ a: 1, b: 2 }] },
    ghost_table: { rows: [{ id: 1 }] },
  } });
  assert.ok(snap.ok);
  const plan = planRestore(snap.snapshot, CATALOG, { mode: "upsert" });
  const names = plan.steps.map((s) => s.table);
  assert.ok(names.indexOf("customers") < names.indexOf("customer_lab_values"));
  const lab = plan.steps.find((s) => s.table === "customer_lab_values")!;
  assert.equal(lab.action, "upsert"); assert.deepEqual(lab.pk, ["id"]);
  assert.equal(plan.steps.find((s) => s.table === "customer_records")!.action, "skip");
  assert.equal(plan.steps.find((s) => s.table === "legacy_no_pk")!.action, "insert");
  assert.match(plan.steps.find((s) => s.table === "ghost_table")!.reason!, /migration/);
  assert.ok(plan.warnings.some((w) => w.includes("removed_col")));
  assert.equal(plan.totals.rows, 3); assert.equal(plan.totals.skipped, 2);
  // only=
  const one = planRestore(snap.snapshot, CATALOG, { mode: "replace", only: ["customers"] });
  assert.deepEqual(one.steps.map((s) => s.table), ["customers"]);
});

test("projectRow drops columns the live table lacks; filename is sortable", () => {
  assert.deepEqual(projectRow({ id: 1, gone: 2, name: "x" }, ["id", "name"]), { id: 1, name: "x" });
  assert.equal(snapshotFilename("2026-09-13T03:00:12.000Z"), "uplabs_20260913_030012.json");
});
