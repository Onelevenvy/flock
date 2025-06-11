/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ChatResponse = {
    properties: {
        type: {
    type: 'string',
    isRequired: true,
},
        id: {
    type: 'string',
    isRequired: true,
},
        name: {
    type: 'string',
    isRequired: true,
},
        content: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        imgdata: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        tool_calls: {
    type: 'any-of',
    contains: [{
    type: 'array',
    contains: {
        type: 'ToolCall',
    },
}, {
    type: 'null',
}],
},
        tool_output: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        documents: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        next: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
