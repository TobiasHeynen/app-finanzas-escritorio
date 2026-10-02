/**
 * Lo único que la lógica compartida necesita de SQLite. En la PC lo implementa better-sqlite3 tal cual;
 * en el celu, un adaptador sobre la API sincrónica de expo-sqlite. Misma forma que better-sqlite3:
 * parámetros posicionales o un objeto con nombres (`@nombre` en el SQL), resultados sincrónicos.
 */
export interface SqlRunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface SqlStatement<Params extends unknown[], Row> {
  run(...params: Params): SqlRunResult
  get(...params: Params): Row | undefined
  all(...params: Params): Row[]
}

export interface SqlDb {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mismo default que better-sqlite3
  prepare<Params extends unknown[] | {} = unknown[], Row = unknown>(
    sql: string,
  ): Params extends unknown[] ? SqlStatement<Params, Row> : SqlStatement<[Params], Row>
  /** Envuelve `fn` en una transacción: devuelve una función que la corre entre BEGIN y COMMIT. */
  transaction<T>(fn: () => T): () => T
  exec(sql: string): unknown
}
