/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelProviderCreate = {
    properties: {
        provider_name: {
    type: 'string',
    isRequired: true,
    pattern: '^[a-zA-Z0-9_-]{1,64}$',
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
    type: 'string',
    isRequired: true,
},
    },
} as const;
