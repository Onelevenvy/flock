/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ToolInvokeResponse = {
    properties: {
        messages: {
    type: 'array',
    contains: {
        type: 'ToolMessages',
    },
    isRequired: true,
},
        error: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
