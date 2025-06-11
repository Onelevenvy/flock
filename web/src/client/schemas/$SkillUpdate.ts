/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SkillUpdate = {
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
        display_name: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        managed: {
    type: 'any-of',
    contains: [{
    type: 'boolean',
}, {
    type: 'null',
}],
},
        tool_definition: {
    type: 'any-of',
    contains: [{
    type: 'dictionary',
    contains: {
    properties: {
    },
},
}, {
    type: 'null',
}],
},
        input_parameters: {
    type: 'any-of',
    contains: [{
    type: 'dictionary',
    contains: {
    properties: {
    },
},
}, {
    type: 'null',
}],
},
        credentials: {
    type: 'any-of',
    contains: [{
    type: 'dictionary',
    contains: {
    properties: {
    },
},
}, {
    type: 'null',
}],
},
    },
} as const;
