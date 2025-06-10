/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UploadOut = {
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
    isRequired: true,
},
        id: {
    type: 'number',
    isRequired: true,
},
        last_modified: {
    type: 'string',
    isRequired: true,
    format: 'date-time',
},
        status: {
    type: 'UploadStatus',
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
