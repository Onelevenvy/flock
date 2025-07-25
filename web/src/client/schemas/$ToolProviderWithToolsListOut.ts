/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ToolProviderWithToolsListOut = {
    properties: {
        id: {
            type: 'number',
            isRequired: true,
        },
        provider_name: {
            type: 'string',
            isRequired: true,
        },
        display_name: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        mcp_endpoint_url: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        mcp_server_id: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        mcp_connection_type: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        icon: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        tool_type: {
            type: 'ToolType',
            isRequired: true,
        },
        description: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        credentials: {
            type: 'any-of',
            contains: [{
                type: 'dictionary',
                contains: {
                    properties: {
                    },
                },
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        is_available: {
            type: 'any-of',
            contains: [{
                type: 'boolean',
            }, {
                type: 'null',
            }],
        },
        tools: {
            type: 'array',
            contains: {
                type: 'ToolOutIdWithAndName',
            },
            isRequired: true,
        },
    },
} as const;
