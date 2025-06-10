/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Body_uploads_create_upload = {
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
        chunk_size: {
    type: 'number',
    isRequired: true,
},
        chunk_overlap: {
    type: 'number',
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
        file: {
    type: 'any-of',
    contains: [{
    type: 'binary',
    format: 'binary',
}, {
    type: 'null',
}],
},
    },
} as const;
