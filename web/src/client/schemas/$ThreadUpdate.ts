/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ThreadUpdate = {
    properties: {
        query: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        updated_at: {
    type: 'any-of',
    contains: [{
    type: 'string',
    format: 'date-time',
}, {
    type: 'null',
}],
},
    },
} as const;
