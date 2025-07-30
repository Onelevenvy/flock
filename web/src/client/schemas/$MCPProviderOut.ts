/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MCPProviderOut = {
    properties: {
        id: {
            type: 'number',
            isRequired: true,
        },
        provider_name: {
            type: 'string',
            isRequired: true,
        },
        mcp_endpoint_url: {
            type: 'string',
            isRequired: true,
        },
        mcp_server_id: {
            type: 'string',
            isRequired: true,
        },
        mcp_connection_type: {
            type: 'string',
            isRequired: true,
        },
        icon: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
    },
} as const;
