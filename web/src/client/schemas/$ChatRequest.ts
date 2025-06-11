/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ChatRequest = {
  properties: {
    messages: {
      type: "any-of",
      description: `History of messages between the user and the assistant`,
      contains: [
        {
          type: "array",
          contains: {
            type: "app__core__langmanus__server__chat_request__ChatMessage",
          },
        },
        {
          type: "null",
        },
      ],
    },
    resources: {
      type: "any-of",
      description: `Resources to be used for the research`,
      contains: [
        {
          type: "array",
          contains: {
            type: "Resource",
          },
        },
        {
          type: "null",
        },
      ],
    },
    debug: {
      type: "any-of",
      description: `Whether to enable debug logging`,
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    thread_id: {
      type: "any-of",
      description: `A specific conversation identifier`,
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    max_plan_iterations: {
      type: "any-of",
      description: `The maximum number of plan iterations`,
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    max_step_num: {
      type: "any-of",
      description: `The maximum number of steps in a plan`,
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    max_search_results: {
      type: "any-of",
      description: `The maximum number of search results`,
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    auto_accepted_plan: {
      type: "any-of",
      description: `Whether to automatically accept the plan`,
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    interrupt_feedback: {
      type: "any-of",
      description: `Interrupt feedback from the user on the plan`,
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    mcp_settings: {
      type: "any-of",
      description: `MCP settings for the chat request`,
      contains: [
        {
          type: "dictionary",
          contains: {
            properties: {},
          },
        },
        {
          type: "null",
        },
      ],
    },
    enable_background_investigation: {
      type: "any-of",
      description: `Whether to get background investigation before plan`,
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const;
