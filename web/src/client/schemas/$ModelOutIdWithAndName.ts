/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelOutIdWithAndName = {
    properties: {
        id: {
    type: 'number',
    isRequired: true,
},
        ai_model_name: {
    type: 'string',
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
    isRequired: true,
},
    },
} as const;
