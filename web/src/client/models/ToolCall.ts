/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * Represents a request to call a tool.
 *
 * Example:
 *
 * .. code-block:: python
 *
 * {
     * "name": "foo",
     * "args": {"a": 1},
     * "id": "123"
     * }
     *
     * This represents a request to call the tool named "foo" with arguments {"a": 1}
     * and an identifier of "123".
 */
export type ToolCall = {
    name: string;
    args: Record<string, any>;
    id: (string | null);
    type?: string;
};
