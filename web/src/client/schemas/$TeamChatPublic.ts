/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $TeamChatPublic = {
    properties: {
        message: {
            type: 'any-of',
            contains: [{
                type: 'ChatMessage',
            }, {
                type: 'null',
            }],
        },
        interrupt: {
            type: 'any-of',
            contains: [{
                type: 'Interrupt',
            }, {
                type: 'null',
            }],
        },
    },
} as const;
