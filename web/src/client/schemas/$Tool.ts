/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Tool = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 64,
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
        display_name: {
            type: 'any-of',
            contains: [{
                type: 'string',
                maxLength: 128,
            }, {
                type: 'null',
            }],
        },
        managed: {
            type: 'boolean',
        },
        tool_definition: {
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
        id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        owner_id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
    },
} as const;
