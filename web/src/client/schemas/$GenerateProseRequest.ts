/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $GenerateProseRequest = {
  properties: {
    prompt: {
      type: "string",
      description: `The content of the prose`,
      isRequired: true,
    },
    option: {
      type: "string",
      description: `The option of the prose writer`,
      isRequired: true,
    },
    command: {
      type: "any-of",
      description: `The user custom command of the prose writer`,
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
