import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow
} from "pg";

export type SqlQuery =
  | string
  | {
      text: string;
      values?: unknown[];
    };

export class PostgresClient {
  private readonly pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    query: SqlQuery,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> {
    if (typeof query === "string") {
      return this.pool.query<Row>(query, values);
    }

    return this.pool.query<Row>(query.text, query.values);
  }

  async transaction<T>(
    callback: (client: PostgresSession) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const session = new PostgresSession(client);
      const result = await callback(session);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class PostgresSession {
  private readonly client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    query: SqlQuery,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> {
    if (typeof query === "string") {
      return this.client.query<Row>(query, values);
    }

    return this.client.query<Row>(query.text, query.values);
  }
}
