/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserOut = {
    properties: {
        email: {
            type: 'string',
            isRequired: true,
        },
        is_active: {
            type: 'boolean',
        },
        is_superuser: {
            type: 'boolean',
        },
        full_name: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        language: {
            type: 'string',
        },
        id: {
            type: 'number',
            isRequired: true,
        },
        groups: {
            type: 'any-of',
            contains: [{
                type: 'array',
                contains: {
                    type: 'Group',
                },
            }, {
                type: 'null',
            }],
        },
        roles: {
            type: 'any-of',
            contains: [{
                type: 'array',
                contains: {
                    type: 'Role',
                },
            }, {
                type: 'null',
            }],
        },
    },
} as const;
