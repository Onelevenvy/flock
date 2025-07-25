/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelUpdate = {
    properties: {
        ai_model_name: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        provider_id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        categories: {
            type: 'any-of',
            contains: [{
                type: 'null',
            }],
        },
        capabilities: {
            type: 'any-of',
            contains: [{
                type: 'null',
            }],
        },
        is_online: {
            type: 'boolean',
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
