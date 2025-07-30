/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ToolType } from './ToolType';

export type ToolProviderOut = {
    id: number;
    provider_name: string;
    display_name: (string | null);
    mcp_endpoint_url: (string | null);
    mcp_server_id: (string | null);
    mcp_connection_type: (string | null);
    icon: (string | null);
    tool_type: ToolType;
    description: (string | null);
    credentials: (Record<string, any> | null);
    is_available?: (boolean | null);
};

