/**
 * Airtable "Run a script" automation globals (subset used by airtable/cct/automations).
 * Hand-written: Airtable publishes no official typings for the scripting environment.
 * Covers only what our scripts call; extend here when a script needs more.
 * Reference: https://airtable.com/developers/scripting/api
 */
declare namespace AirtableScripting {
  type CellValue = unknown;
  type FieldRef = string | { id: string };

  interface Field { id: string; name: string; type: string }
  interface RecordQueryResult { records: Record[] }
  interface Record {
    id: string;
    name: string;
    getCellValue(field: FieldRef): CellValue;
    getCellValueAsString(field: FieldRef): string;
  }
  interface Table {
    id: string;
    name: string;
    fields: Field[];
    getField(idOrName: string): Field;
    getFieldIfExists(idOrName: string): Field | null;
    selectRecordsAsync(opts?: { fields?: FieldRef[]; sorts?: unknown[] }): Promise<RecordQueryResult>;
    createRecordAsync(fields: { [fieldIdOrName: string]: CellValue }): Promise<string>;
    createRecordsAsync(records: { fields: { [fieldIdOrName: string]: CellValue } }[]): Promise<string[]>;
    updateRecordAsync(recordOrId: string | Record, fields: { [fieldIdOrName: string]: CellValue }): Promise<void>;
    updateRecordsAsync(records: { id: string; fields: { [fieldIdOrName: string]: CellValue } }[]): Promise<void>;
  }
  interface Base {
    getTable(idOrName: string): Table;
    getTableIfExists(idOrName: string): Table | null;
  }
  interface Input { config(): { [key: string]: unknown } }
  interface Output { set(key: string, value: unknown): void }
}

declare const base: AirtableScripting.Base;
declare const input: AirtableScripting.Input;
declare const output: AirtableScripting.Output;
