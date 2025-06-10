/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $TeamCreate = {
    properties: {
        name: {
    type: 'string',
    isRequired: true,
    pattern: '^[a-zA-Z0-9_-]{1,64}$',
},
        description: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        icon: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        workflow: {
    type: 'string',
    isRequired: true,
},
    },
} as const;
