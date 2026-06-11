import alasql from "alasql";

export interface NodeState {
  path: string;
  visitor: QueryVisitor;
  parent: any | null;
  key: string | number;
}

export interface NodeProcessor {
  enter: (element: any, state: NodeState) => boolean | undefined;
  leave?: (element: any, state: NodeState) => void;
  value?: (element: any, state: NodeState) => void;
}

export class QueryVisitor {
  readonly map: Record<string, any> = {};
  private cache: WeakSet<any> = new WeakSet();

  constructor(
    readonly root: any,
    readonly visitor: NodeProcessor,
  ) {
    this.visit(root, "", null, "", true);
  }

  visit(
    element: any,
    path: string,
    parent: any | null,
    key: string | number,
    visit?: boolean,
  ) {
    if (element === undefined || element === null || this.cache.has(element)) {
      return;
    }
    if (Array.isArray(element)) {
      this.map[path] = element;
      element.forEach((item, index) => {
        this.visit(item, `${path}/${index}`, element, index, visit);
      });
    }
    if (typeof element === "object") {
      this.cache.add(element);
      this.map[path] = element;
      const doVisit =
        visit == false
          ? false
          : this.visitor.enter(element, {
              path: path,
              parent: parent,
              key,
              visitor: this,
            });
      for (const [key, value] of Object.entries(element)) {
        this.visit(value, `${path}/${key}`, element, key, doVisit);
      }
      if (visit !== false && this.visitor.leave) {
        this.visitor.leave(element, {
          path: path,
          parent: parent,
          key,
          visitor: this,
        });
      }
    } else {
      this.map[path] = element;
      if (visit !== false && this.visitor.value) {
        this.visitor.value(element, {
          path: path,
          parent: parent,
          key,
          visitor: this,
        });
      }
    }
  }
}
