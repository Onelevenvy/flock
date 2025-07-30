/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RolesOut = {
    description: `Schema for roles output`,
    properties: {
        data: {
            type: 'array',
            contains: {
                type: 'RoleOut',
            },
            isRequired: true,
        },
        count: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
