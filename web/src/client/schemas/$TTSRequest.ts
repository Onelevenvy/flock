/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $TTSRequest = {
    properties: {
        text: {
    type: 'string',
    description: `The text to convert to speech`,
    isRequired: true,
},
        voice_type: {
    type: 'any-of',
    description: `The voice type to use`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        encoding: {
    type: 'any-of',
    description: `The audio encoding format`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        speed_ratio: {
    type: 'any-of',
    description: `Speech speed ratio`,
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        volume_ratio: {
    type: 'any-of',
    description: `Speech volume ratio`,
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        pitch_ratio: {
    type: 'any-of',
    description: `Speech pitch ratio`,
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        text_type: {
    type: 'any-of',
    description: `Text type (plain or ssml)`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
        with_frontend: {
    type: 'any-of',
    description: `Whether to use frontend processing`,
    contains: [{
    type: 'number',
}, {
    type: 'null',
}],
},
        frontend_type: {
    type: 'any-of',
    description: `Frontend type`,
    contains: [{
    type: 'string',
}, {
    type: 'null',
}],
},
    },
} as const;
