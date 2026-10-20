import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";
import * as database from "../utils/database";

export class QueryTools extends BaseTools {
    static create(server: McpServer) {
        const tools = new QueryTools();

        /* oldcode
        server.tool(
            "query",
            "Query the database with a SQL statement",
            {
				databaseID: z.string().describe("L'id del database da interrogare"),
				query: z.string().describe("The SQL query to execute")
			},
            tools.query.bind(tools)
        );
        */

		server.tool(
			"query",
			// oldcode: "Run a read-only SQL query (SELECT). The statements are checked before execution: data or schema changes, SELECT INTO, EXEC, transactions and USE are refused. Use the \"execute\" tool for changes.",
			"Run any read-only SQL: SELECT queries, including INFORMATION_SCHEMA / sys catalog lookups, DECLARE/SET of variables and IF/WHILE. This is the tool for every read. The statements are checked before execution: data or schema changes, SELECT INTO, EXEC, transactions and USE are refused; use \"execute-write\" only for those.",
			{
				databaseID: z.string().describe("L'id del database da interrogare"),
				query: z.string().describe("The read-only SQL query to execute")
			},
			tools.query.bind(tools)
		);

		server.tool(
			// oldcode: "execute",
			"execute-write",
			// oldcode: "Execute a SQL statement that changes data or schema (INSERT, UPDATE, DELETE, MERGE, DDL, EXEC). Changes are committed immediately. Refused on databases configured as READ_ONLY.",
			"WRITE ONLY: execute a SQL statement that changes data or schema (INSERT, UPDATE, DELETE, MERGE, DDL) or calls a stored procedure (EXEC). Never use it for SELECT or other reads: read-only batches are refused, use the \"query\" tool instead. Changes are committed immediately and require user confirmation. Refused on databases configured as READ_ONLY.",
			{
				databaseID: z.string().describe("L'id del database su cui eseguire lo statement"),
				query: z.string().describe("The SQL statement to execute")
			},
			tools.execute.bind(tools)
		);

        return tools;
    }

    async query({ databaseID, query }: { databaseID:string, query: string }) {
        // oldcode: const results = await database.query(databaseID, query);
		const results = await database.readOnlyQuery(databaseID, query);
        if (!results?.length) return this.toResult("No results found for the query.");
        return this.toResult(JSON.stringify(results));
    }

	async execute({ databaseID, query }: { databaseID: string, query: string }) {
		const { recordset, rowsAffected } = await database.execute(databaseID, query);
		let text = `Rows affected: ${JSON.stringify(rowsAffected)}`;
		if (recordset?.length) text += `\n${JSON.stringify(recordset)}`;
		return this.toResult(text);
	}
}
