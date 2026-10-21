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

		// registerTool (al posto di server.tool) per poter pubblicare _meta:
		// - query: "anthropic/alwaysLoad" -> Claude Code lo carica subito invece di farlo cercare
		// - execute-write: "anthropic/requiresUserInteraction" -> Claude Code chiede conferma a ogni chiamata, senza "don't ask again"
		/* oldcode
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
		*/

		server.registerTool(
			"query",
			{
				description: "Run any read-only SQL: SELECT queries, including INFORMATION_SCHEMA / sys catalog lookups, DECLARE/SET of variables and IF/WHILE. This is the tool for every read. The statements are checked before execution: data or schema changes, SELECT INTO, EXEC, transactions and USE are refused; use \"execute-write\" only for those.",
				inputSchema: {
					databaseID: z.string().describe("L'id del database da interrogare"),
					query: z.string().describe("The read-only SQL query to execute")
				},
				_meta: { "anthropic/alwaysLoad": true }
			},
			tools.query.bind(tools)
		);

		server.registerTool(
			"get-connection-info",
			{
				description: "Get the connection details of a database (no credentials): host, port, database name, environment (svi/coll/prod/local), READ_ONLY flag and the \"target\" string that execute-write requires. Call it before execute-write.",
				inputSchema: {
					databaseID: z.string().describe("L'id del database")
				},
				_meta: { "anthropic/alwaysLoad": true }
			},
			tools.connectionInfo.bind(tools)
		);

		server.registerTool(
			"execute-write",
			{
				// oldcode: description: "WRITE ONLY: execute a SQL statement that changes data or schema (INSERT, UPDATE, DELETE, MERGE, DDL) or calls a stored procedure (EXEC). Never use it for SELECT or other reads: read-only batches are refused, use the \"query\" tool instead. Changes are committed immediately and require user confirmation. Refused on databases configured as READ_ONLY.",
				description: "WRITE ONLY: execute a SQL statement that changes data or schema (INSERT, UPDATE, DELETE, MERGE, DDL) or calls a stored procedure (EXEC). Never use it for SELECT or other reads: read-only batches are refused, use the \"query\" tool instead. The \"target\" parameter is required and must be exactly the \"target\" value returned by get-connection-info for the same databaseID: the call is refused if it does not match the current connection. Changes are committed immediately and require user confirmation. Refused on databases configured as READ_ONLY.",
				inputSchema: {
					databaseID: z.string().describe("L'id del database su cui eseguire lo statement"),
					target: z.string().describe("Host, database e ambiente della connessione, esattamente come restituiti da get-connection-info (es. \"10.1.1.83/morca (svi)\")"),
					query: z.string().describe("The SQL statement to execute")
				},
				_meta: { "anthropic/requiresUserInteraction": true }
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

	async connectionInfo({ databaseID }: { databaseID: string }) {
		return this.toResult(JSON.stringify(database.connectionInfo(databaseID)));
	}

	// oldcode: async execute({ databaseID, query }: { databaseID: string, query: string }) {
	async execute({ databaseID, query, target }: { databaseID: string, query: string, target: string }) {
		// oldcode: const { recordset, rowsAffected } = await database.execute(databaseID, query);
		const { recordset, rowsAffected } = await database.execute(databaseID, query, target);
		let text = `Rows affected: ${JSON.stringify(rowsAffected)}`;
		if (recordset?.length) text += `\n${JSON.stringify(recordset)}`;
		return this.toResult(text);
	}
}
