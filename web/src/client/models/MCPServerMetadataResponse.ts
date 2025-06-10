/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * Response model for MCP server metadata.
 */
export type MCPServerMetadataResponse = {
    /**
     * The type of MCP server connection (stdio or sse)
     */
    transport: string;
    /**
     * The command to execute (for stdio type)
     */
    command?: (string | null);
    /**
     * Command arguments (for stdio type)
     */
    args?: (Array<string> | null);
    /**
     * The URL of the SSE server (for sse type)
     */
    url?: (string | null);
    /**
     * Environment variables
     */
    env?: (Record<string, string> | null);
    /**
     * Available tools from the MCP server
     */
    tools?: Array<any>;
};
