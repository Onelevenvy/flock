/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $GroupUpdate = {
    description: `Schema for updating a group`,
    properties: {
        name: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
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
    type: 'any-of',
    contains: [{
    type: 'boolean',
}, {
    type: 'null',
}],
},
    },
} as const;
