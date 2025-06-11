/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SubgraphUpdate = {
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
        is_public: {
    type: 'boolean',
},
        updated_at: {
    type: 'string',
    isRequired: true,
    format: 'date-time',
},
        id: {
    type: 'any-of',
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        team_id: {
    type: 'any-of',
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
    },
} as const;
