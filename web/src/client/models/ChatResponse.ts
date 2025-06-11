/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ToolCall } from './ToolCall';

export type ChatResponse = {
    type: string;
    id: string;
    name: string;
    content?: (string | null);
    imgdata?: (string | null);
    tool_calls?: (Array<ToolCall> | null);
    tool_output?: (string | null);
    documents?: (string | null);
    next?: (string | null);
};
