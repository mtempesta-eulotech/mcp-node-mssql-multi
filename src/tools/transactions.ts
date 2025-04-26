import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "node:crypto";
import { z } from "zod";
import { BaseTools } from "./base";
import * as database from "../utils/database";

export class TransactionTools extends BaseTools {
    transactions: Map<string, any> = new Map();

    static create(server: McpServer) {
        const tools = new TransactionTools();

        server.tool(
            "start-transaction",
            "Start a new transaction",
            tools.startTransaction.bind(tools)
        );

        server.tool(
            "commit-transaction",
            "Commit a transaction",
            { transactionId: z.string().describe("The ID of the transaction to commit.") },
            tools.commitTransaction.bind(tools),
        );

        server.tool(
            "rollback-transaction",
            "Rollback a transaction",
            { transactionId: z.string().describe("The ID of the transaction to rollback.") },
            tools.rollbackTransaction.bind(tools),
        );

        return tools;
    }

    async startTransaction() {
        const transactionId = crypto.randomUUID();
        const transaction = await database.startTransaction();
        this.transactions.set(transactionId, transaction);

        return this.toResult(`Transaction started with ID: ${transactionId}.  You can use this ID to commit or rollback the transaction later.`);
    }

    async commitTransaction({ transactionId }: { transactionId: string }) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction with ID ${transactionId} not found.`);
        }

        await transaction.commit();
        this.transactions.delete(transactionId);

        return this.toResult(`Transaction with ID ${transactionId} committed successfully.`);
    }

    async rollbackTransaction({ transactionId }: { transactionId: string }) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction with ID ${transactionId} not found.`);
        }

        await transaction.rollback();
        this.transactions.delete(transactionId);

        return this.toResult(`Transaction with ID ${transactionId} rolled back successfully.`);
    }
}
