/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "./Context";
import { Table } from "./models";
import { EvalQuery, AttributeColumn } from "./nodes";
import { EvalNode, isEqual, type DType } from "./types";

export class EvalCreateTable extends EvalNode {
  constructor(
    readonly context: Context,
    readonly name: string,
    readonly columns: Array<{ name: string; type: DType }>,
    readonly using: string = "",
    readonly data?: EvalQuery,
  ) {
    super(EvalCreateTable);
  }

  get childNodes(): EvalNode[] {
    throw new Error("Method not implemented.");
  }

  resolve(context?: any): [{ name: string; type: DType }[], unknown[][]] {
    const columns = this.columns.map(
      (it) => new AttributeColumn(it.name, it.type),
    );
    let table = Table.create(this.name, ...columns);
    const data: unknown[][] = [];
    if (this.data) {
      const [_, queryData] = this.data.resolve(context);
      table = table.data(queryData);
      data.push(...queryData);
    }
    this.context.withTables(table);
    return [this.columns, data];
  }

  isEqual(obj: any): boolean {
    if (!(obj instanceof EvalCreateTable)) {
      return false;
    }
    return (
      this.name === obj.name &&
      this.using == obj.using &&
      isEqual(this.data, obj.data)
    );
  }
}
