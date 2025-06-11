/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MCPServerMetadataRequest = {
  description: `Request model for MCP server metadata.`,
  properties: {
    transport: {
      type: "string",
      description: `The type of MCP server connection (stdio or sse)`,
      isRequired: true,
    },
    command: {
      type: "any-of",
      description: `The command to execute (for stdio type)`,
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    args: {
      type: "any-of",
      description: `Command arguments (for stdio type)`,
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    url: {
      type: "any-of",
      description: `The URL of the SSE server (for sse type)`,
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    env: {
      type: "any-of",
      description: `Environment variables`,
      contains: [
        {
          type: "dictionary",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    timeout_seconds: {
      type: "any-of",
      description: `Optional custom timeout in seconds for the operation`,
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const;
