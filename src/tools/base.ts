import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Base class for all tools.
 */
export class BaseTools {
    constructor() {}

    protected toResult(content: string): CallToolResult {
        return { content: [{ type: "text", text: content }] };
    }
}
