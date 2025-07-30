/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ProvidersListWithToolsOut = {
    properties: {
        providers: {
            type: 'array',
            contains: {
                type: 'ToolProviderWithToolsListOut',
            },
            isRequired: true,
        },
    },
} as const;
