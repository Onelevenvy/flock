/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ContentItem = {
    properties: {
        type: {
    type: 'string',
    description: `The type of content (text, image, etc.)`,
    isRequired: true,
},
        text: {
    type: 'any-of',
    description: `The text content if type is 'text'`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        image_url: {
    type: 'any-of',
    description: `The image URL if type is 'image'`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
