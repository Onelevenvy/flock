/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelCreate = {
    properties: {
        ai_model_name: {
            type: 'string',
            isRequired: true,
            pattern: '^[a-zA-Z0-9/_:.-]{1,64}$',
        },
        provider_id: {
            type: 'number',
            isRequired: true,
        },
        categories: {
            type: 'array',
            contains: {
                type: 'ModelCategory',
            },
            isRequired: true,
        },
        capabilities: {
            type: 'array',
            contains: {
                type: 'ModelCapability',
            },
        },
        meta_: {
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
    },
} as const;