/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $GroupsOut = {
    description: `Schema for groups output`,
    properties: {
        data: {
            type: 'array',
            contains: {
                type: 'GroupOut',
            },
            isRequired: true,
        },
        count: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
