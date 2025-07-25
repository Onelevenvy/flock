/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ToolCall = {
    description: `Represents a request to call a tool.

    Example:

    .. code-block:: python

    {
        "name": "foo",
        "args": {"a": 1},
        "id": "123"
    }

    This represents a request to call the tool named "foo" with arguments {"a": 1}
    and an identifier of "123".`,
    properties: {
        name: {
            type: 'string',
            isRequired: true,
        },
        args: {
            type: 'dictionary',
            contains: {
                properties: {
                },
            },
            isRequired: true,
        },
        id: {
            type: 'any-of',
            contains: [{
                type: 'string',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
        type: {
            type: 'string',
        },
    },
} as const;
