/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ThreadRead = {
    properties: {
        id: {
    type: 'string',
    isRequired: true,
    format: 'uuid',
},
        query: {
    type: 'string',
    isRequired: true,
},
        updated_at: {
    type: 'string',
    isRequired: true,
    format: 'date-time',
},
        messages: {
    type: 'array',
    contains: {
        type: 'ChatResponse',
    },
    isRequired: true,
},
    },
} as const;
