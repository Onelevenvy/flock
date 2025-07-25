/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Upload = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
        },
        file_type: {
            type: 'string',
            isRequired: true,
        },
        web_url: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
        },
        id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        resource_id: {
            type: 'number',
            isRequired: true,
        },
        owner_id: {
            type: 'any-of',
            contains: [{
                type: 'number',
            }, {
                type: 'null',
            }],
        },
        last_modified: {
            type: 'string',
            format: 'date-time',
        },
        status: {
            type: 'UploadStatus',
            isRequired: true,
        },
        chunk_size: {
            type: 'number',
            isRequired: true,
        },
        chunk_overlap: {
            type: 'number',
            isRequired: true,
        },
    },
} as const;
