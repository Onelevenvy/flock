/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SubgraphCreate = {
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
        created_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updated_at: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        team_id: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
