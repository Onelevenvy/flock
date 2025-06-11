/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Resource = {
  description: `Resource is a class that represents a resource.`,
  properties: {
    uri: {
      type: "string",
      description: `The URI of the resource`,
      isRequired: true,
    },
    title: {
      type: "string",
      description: `The title of the resource`,
      isRequired: true,
    },
    description: {
      type: "any-of",
      description: `The description of the resource`,
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
