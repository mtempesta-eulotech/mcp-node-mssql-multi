import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { name, version } from "../package.json";

import { SchemaTools } from "./tools/schema";
import { QueryTools } from "./tools/query";
import { TransactionTools } from "./tools/transactions";

const { DB_CONF } = process.env;
if (!DB_CONF) {
	console.error("Dichiarare la variabile d'ambiente DB_CONF come un json avente chiave l'id del database e valore un json con (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE) are required");
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
