declare module 'sql.js' {
  export type SqlValue = Uint8Array | number | string | null

  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export interface Database {
    close(): void
    exec(sql: string, params?: SqlValue[]): QueryExecResult[]
    export(): Uint8Array
    run(sql: string, params?: SqlValue[]): Database
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | Buffer) => Database
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
