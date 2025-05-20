import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";
import * as database from "../utils/database";

export class QueryTools extends BaseTools {
    static create(server: McpServer) {
        const tools = new QueryTools();

        server.tool(
            "query",
            "Query the database with a SQL statement",
            {
				databaseID: z.string().describe("L'id del database da interrogare"),
				query: z.string().describe("The SQL query to execute")
			},
            tools.query.bind(tools)
        );

        return tools;
    }

    async query({ databaseID, query }: { databaseID:string, query: string }) {
        const results = await database.query(databaseID, query);
        if (!results.length) return this.toResult("No results found for the query.");
        return this.toResult(JSON.stringify(results));
    }
}
