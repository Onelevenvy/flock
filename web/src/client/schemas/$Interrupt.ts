/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Interrupt = {
    properties: {
        interaction_type: {
    type: 'any-of',
    contains: [{
    type: 'InterruptType',
}, {
    type: 'null',
}],
},
        decision: {
    type: 'InterruptDecision',
    isRequired: true,
},
        tool_message: {
    type: 'any-of',
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
