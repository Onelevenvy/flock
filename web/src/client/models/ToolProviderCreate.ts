/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ToolType } from './ToolType';

export type ToolProviderCreate = {
    provider_name: string;
    mcp_endpoint_url?: (string | null);
    mcp_server_id?: (string | null);
    mcp_connection_type?: (string | null);
    icon?: (string | null);
    description?: (string | null);
    credentials?: (Record<string, any> | null);
    is_available?: (boolean | null);
    tool_type?: ToolType;
    display_name?: (string | null);
};

