import pool from "@/lib/db";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

type QueryConfig = { text: string; values?: any[] };

type QueryInput = string | QueryConfig;

type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  input: QueryInput,
  params?: any[]
) => Promise<QueryResult<T>>;

async function runQuery<T extends QueryResultRow = QueryResultRow>(
  input: QueryInput,
  params?: any[]
): Promise<QueryResult<T>> {
  if (typeof input === "string") {
    return pool.query<T>(input, params);
  }
  return pool.query<T>(input.text, input.values);
}

export const db = {
  query: runQuery,
  async tx<T>(fn: (client: { query: QueryFn; raw: PoolClient }) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query: QueryFn = (input, params) => {
        if (typeof input === "string") {
          return client.query(input, params);
        }
        return client.query(input.text, input.values);
      };
      const result = await fn({ query, raw: client });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export type DB = typeof db;
