/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ThreadsOut = {
    properties: {
        data: {
    type: 'array',
    contains: {
        type: 'ThreadOut',
    },
    isRequired: true,
},
        count: {
    type: 'number',
    isRequired: true,
},
    },
} as const;
