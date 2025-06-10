/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RAGResourcesResponse = {
    description: `Response model for RAG resources.`,
    properties: {
        resources: {
    type: 'array',
    contains: {
        type: 'Resource',
    },
    isRequired: true,
},
    },
} as const;
