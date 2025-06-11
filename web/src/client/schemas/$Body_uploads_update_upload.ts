/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Body_uploads_update_upload = {
    properties: {
        name: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        description: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        file_type: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        chunk_size: {
    type: 'any-of',
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        chunk_overlap: {
    type: 'any-of',
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
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
