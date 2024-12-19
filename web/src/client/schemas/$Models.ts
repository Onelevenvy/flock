/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Models = {
    properties: {
        ai_model_name: {
            type: 'string',
            isRequired: true,
            maxLength: 128,
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
        id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        meta_: {
            type: 'dictionary',
            contains: {
                properties: {
                },
            },
        },
    },
} as const;
