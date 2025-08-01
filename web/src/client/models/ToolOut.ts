/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ToolProviderOut } from './ToolProviderOut';

export type ToolOut = {
    id: number;
    name: string;
    description: string;
    display_name: (string | null);
    managed: boolean;
    tool_definition: (Record<string, any> | null);
    input_parameters: (Record<string, any> | null);
    is_online?: (boolean | null);
    provider: ToolProviderOut;
};

