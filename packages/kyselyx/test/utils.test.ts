import { describe, expect, test } from "vitest";
import { Migration, doesNameMatch, getNameParts } from "../src/utils";

/**
 * A helper function for creating a migration objects for testing.
 */
function createMigration(timestamp: number, label: string): Migration {
  return {
    timestamp,
    label,
    name: `${timestamp}_${label}`,
    executedAt: undefined,
    migration: { up: async () => {}, down: async () => {} },
  };
}

describe("doesNameMatch", () => {
  test("matches when name match exactly", () => {
    const name = "1612345678_create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("matches when labels match & no timestamp", () => {
    const name = "create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("matches when labels match & timestamp matches partially", () => {
    const name = "78_create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("does not match when labels do not match", () => {
    const name = "1612345678_create_table";
    const item = createMigration(1612345678, "create_table_2");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });

  test("does not match when labels do not match & no timestamp", () => {
    const name = "create_table";
    const item = createMigration(1612345678, "create_table_2");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });

  test("does not match when labels match & timestamp does not match", () => {
    const name = "1612345678_create_table";
    const item = createMigration(161234567, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });
});

describe("getNameParts", () => {
  test("returns parts when name is valid", () => {
    const item = createMigration(1612345678, "create_table");
    const result = getNameParts(item);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.timestamp).toBe(1612345678);
      expect(result.value.label).toBe("create_table");
    }
  });

  test("returns error when timestamp is missing", () => {
    const item = createMigration(NaN, "create_table");
    const result = getNameParts(item);
    expect(result.isErr()).toBe(true);
  });

  test("returns error when label is missing", () => {
    const item = createMigration(1612345678, "");
    const result = getNameParts(item);
    expect(result.isErr()).toBe(true);
  });
});
