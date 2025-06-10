/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RAGConfigResponse = {
    description: `Response model for RAG config.`,
    properties: {
        provider: {
    type: 'any-of',
    description: `The provider of the RAG, default is ragflow`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
