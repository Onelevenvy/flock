/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ToolCreate = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            pattern: '^[a-zA-Z0-9_-]{1,64}$',
        },
        description: {
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
        },
        managed: {
            type: 'boolean',
        },
        tool_definition: {
            type: 'dictionary',
            contains: {
                properties: {
                },
            },
            isRequired: true,
        },
        input_parameters: {
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
        provider_id: {
            type: 'number',
            isRequired: true,
        },
        is_online: {
            type: 'boolean',
        },
    },
} as const;
