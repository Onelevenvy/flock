/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ModelProviderWithModelsListOut = {
    properties: {
        id: {
    type: 'number',
    isRequired: true,
},
        provider_name: {
    type: 'string',
    isRequired: true,
},
        base_url: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
    isRequired: true,
},
        api_key: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
    isRequired: true,
},
        icon: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
    isRequired: true,
},
        description: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
    isRequired: true,
},
        models: {
    type: 'array',
    contains: {
        type: 'ModelOutIdWithAndName',
    },
    isRequired: true,
},
    },
} as const;
