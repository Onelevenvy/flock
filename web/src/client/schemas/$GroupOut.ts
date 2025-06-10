/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $GroupOut = {
    description: `Schema for group output`,
    properties: {
        name: {
    type: 'string',
    isRequired: true,
},
        description: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        is_system_group: {
    type: 'boolean',
},
        id: {
    type: 'number',
    isRequired: true,
},
    },
} as const;
