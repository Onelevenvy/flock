/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelProvider = {
    properties: {
        provider_name: {
    type: 'string',
    isRequired: true,
    maxLength: 64,
},
        base_url: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        api_key: {
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
        description: {
    type: 'any-of',
    contains: [{
    type: 'string',
    maxLength: 256,
}, {
    type: 'null',
}],
},
        id: {
    type: 'any-of',
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
    },
} as const;
