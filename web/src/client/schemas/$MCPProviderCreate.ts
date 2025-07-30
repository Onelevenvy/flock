/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MCPProviderCreate = {
    properties: {
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
            type: 'string',
        },
    },
} as const;
