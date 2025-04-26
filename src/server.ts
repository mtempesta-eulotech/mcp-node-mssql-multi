import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { name, version } from "../package.json";

import { SchemaTools } from "./tools/schema";
import { QueryTools } from "./tools/query";
import { TransactionTools } from "./tools/transactions";

const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = process.env;
if (!DB_HOST || !DB_PORT || !DB_USERNAME || !DB_PASSWORD || !DB_DATABASE) {
	console.error("All database environment variables (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE) are required");
	process.exit(1);
}

const server = new McpServer({ name, version });

SchemaTools.create(server);
QueryTools.create(server);
TransactionTools.create(server);

async function startServer() {
	try {
		await server.connect(new StdioServerTransport());
	} catch (error) {
		console.error("Fatal:", error);
		process.exit(1);
	}
}

startServer();
