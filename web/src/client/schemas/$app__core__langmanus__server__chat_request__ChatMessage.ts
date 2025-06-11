/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $app__core__langmanus__server__chat_request__ChatMessage = {
  properties: {
    role: {
      type: "string",
      description: `The role of the message sender (user or assistant)`,
      isRequired: true,
    },
    content: {
      type: "any-of",
      description: `The content of the message, either a string or a list of content items`,
      contains: [
        {
          type: "string",
        },
        {
          type: "array",
          contains: {
            type: "ContentItem",
          },
        },
      ],
      isRequired: true,
    },
  },
} as const;
