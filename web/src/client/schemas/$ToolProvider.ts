/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ToolProvider = {
    properties: {
        provider_name: {
            type: 'string',
            isRequired: true,
            maxLength: 64,
        },
        mcp_endpoint_url: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        mcp_server_id: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        mcp_connection_type: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        icon: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        description: {
            type: 'any-of',
            contains: [{
                type: 'string',
                maxLength: 256,
            }, {
                type: 'null',
            }],
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
        },
        is_available: {
            type: 'boolean',
        },
        tool_type: {
            type: 'ToolType',
        },
        id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        display_name: {
            type: 'any-of',
            contains: [{
                type: 'string',
                maxLength: 128,
            }, {
                type: 'null',
            }],
        },
    },
} as const;
