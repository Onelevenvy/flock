/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $app__models__ChatMessage = {
  properties: {
    type: {
      type: "ChatMessageType",
      isRequired: true,
    },
    content: {
      type: "string",
      isRequired: true,
    },
    imgdata: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const;
