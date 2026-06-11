import alasql from "alasql";
import { ID_META, type Directives } from "../core/data";
import { parseDirectives } from "../parser/parser";
import { LanguageRecord, type LedgerDatabase, type QueryResult } from "./db";
import { helpFor } from "./help";
import type { Query } from "./query";
import { parser } from "./tree/syntax.grammar";
import { printTree } from "./tree/tree";
import { parseQuery } from "@beancount-js/filters";

function beancountFormat(directives: Directives): string {
  return directives.map((d) => d.toString()).join("\n");
}

export interface DbType {
  render: (records: Array<Record<string, any>> | string) => QueryResult;
  command: (qs: string) => QueryCommand;
  queryParser: Query;
  directives: Directives;
}

export interface QueryCommand {
  pattern: RegExp;
  action: (db: DbType, query: string) => QueryResult;
}

export const defaultCommand: QueryCommand = {
  pattern: /.*/,
  action(db, query) {
    return db.render(db.queryParser.query(query));
  },
};

export const commands: QueryCommand[] = [
  {
    pattern: /^\s*help/i,
    action(db, query) {
      const help = helpFor(query);
      if (help) {
        return { data: [help] };
      }
      return {
        data: [
          {
            HELP: `*** No help on ${query.replace(/^\s*help\s*/i, "").trim()}`,
          },
        ],
      };
    },
  },
  {
    pattern: /^\s*raw\s+/i,
    action(db, query) {
      query = query.replace(/^\s*raw\s+/i, "");
      return db.render(query);
    },
  },
  {
    pattern: /^\s*balances\s+/i,
    action(db, query) {
      query = query.replace(
        /^\s*balances\s+/i,
        "SELECT account, sum(position) ",
      );
      query += "\nORDER BY account";
      return db.render(db.queryParser.query(query));
    },
  },
  {
    pattern: /^\s*journal\s*/i,
    action(db, query) {
      query = query.replace(/^\s*journal\s*/i, "");
      return db.render(
        db.queryParser.query(`
                select
                    postings.date,
                    postings.flag,
                    postings.payee,
                    postings.narration,
                    postings.account,
                    postings.position,
                    postings.balance
                ${query}
            `),
      );
    },
  },
  {
    pattern: /^\s*explain\s+/i,
    action(db, query) {
      query = query.replace(/(^\s*explain\s+)+/i, "").trim();
      const cmd = db.command(query);
      let response: QueryResult | null = null;
      cmd.action(
        {
          queryParser: db.queryParser,
          directives: db.directives,
          command: db.command,
          render(records: Array<Record<string, any>> | string) {
            if (typeof records === "string") {
              response = {
                data: [
                  {
                    SQL: LanguageRecord.sql(records),
                    AST: LanguageRecord.yaml(db.queryParser.parse(records)),
                  },
                ],
              };
              return response;
            }
            response = { data: records };
            return response;
          },
        },
        query,
      );

      return (
        response || {
          data: [
            {
              ERROR: "Unable to explain the query",
              SQL: LanguageRecord.sql(query),
            },
          ],
        }
      );
    },
  },
  {
    pattern: /^\s*parse\s+/i,
    action(db, query) {
      query = query.replace(/^\s*parse\s+/i, "");
      const [parsed, errors, _, ledger] = parseDirectives(query, {
        transform: true,
        attributes: { __linter__: "true" },
      });
      const directives = [...db.directives, ...parsed];
      const doc = ledger.document;
      return db.render([
        {
          tree: new LanguageRecord(printTree(doc.tree, query), parser),
          directives: LanguageRecord.beancount(
            directives.filter((it) => it.meta["__linter__"]),
          ),
          errors: errors.map((e) => e.message),
        },
      ]);
    },
  },
  {
    pattern: /^\s*(lex|tokenize)\s+filter\s+/i,
    action(db, query) {
      query = query.replace(/^\s*(lex|tokenize)\s+filter\s+/i, "");
      const [predicate, errors, tree] = parseQuery(query);
      return db.render([
        {
          TREE: new LanguageRecord(printTree(tree, query), parser),
          directives: [
            LanguageRecord.filter(predicate?.toString() ?? query ?? ""),
            LanguageRecord.yaml(predicate ?? {}),
          ],
          errors: errors,
        },
      ]);
    },
  },
  {
    pattern: /^\s*(lex|tokenize)\s+/i,
    action(db, query) {
      query = query.replace(/^\s*(lex|tokenize)\s+/i, "");
      const [directives, errors, _, ledger] = parseDirectives(query, {
        transform: false,
      });
      const doc = ledger.document;
      return db.render([
        {
          TREE: new LanguageRecord(printTree(doc.tree, query), parser),
          directives: [
            LanguageRecord.beancount(directives),
            LanguageRecord.yaml(directives),
            LanguageRecord.yaml(
              directives.map((it) =>
                doc.findById(it.meta[ID_META]?.toString()),
              ),
            ),
          ],
          errors: errors.map((e) => e.message),
        },
      ]);
    },
  },
  {
    pattern: /(^\s*PRINT\s+)|(^\s*PRINT$)/i,
    action(db, query) {
      if (/WHERE/i.test(query) && /FROM/i.test(query)) {
        query = query.replace(/WHERE/i, " AND ").replace(/FROM/i, "WHERE");
      } else {
        query = query.replace(/FROM/i, "WHERE");
      }
      const response = db.render(
        db.queryParser.toQuery(
          query.replace(/^\s*PRINT/i, "SELECT directive FROM directives "),
          "directives",
        ),
      );
      return {
        data: [
          {
            PRINT: LanguageRecord.beancount(
              beancountFormat(
                response.data.map((it) => it["directive"]).join("\n"),
              ),
            ),
          },
        ],
      };
    },
  },
];
