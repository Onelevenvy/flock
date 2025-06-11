/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $GraphUpdate = {
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
        config: {
    type: 'dictionary',
    contains: {
    properties: {
    },
},
},
        metadata_: {
    type: 'dictionary',
    contains: {
    properties: {
    },
},
},
        updated_at: {
    type: 'string',
    isRequired: true,
    format: 'date-time',
},
    },
} as const;
