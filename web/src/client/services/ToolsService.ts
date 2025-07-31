/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Tool } from '../models/Tool';
import type { ToolBase } from '../models/ToolBase';
import type { ToolCreate } from '../models/ToolCreate';
import type { ToolInvokeResponse } from '../models/ToolInvokeResponse';
import type { ToolsOut } from '../models/ToolsOut';
import type { ToolUpdate } from '../models/ToolUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ToolsService {

    /**
     * Create Tool
     * Create new tool.
     * @returns ToolBase Successful Response
     * @throws ApiError
     */
    public static createTool({
        requestBody,
    }: {
        requestBody: ToolCreate,
    }): CancelablePromise<ToolBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Tools
     * @returns ToolsOut Successful Response
     * @throws ApiError
     */
    public static readTools({
        skip,
        limit = 100,
    }: {
        skip?: number,
        limit?: number,
    }): CancelablePromise<ToolsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tools/',
            query: {
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Tool
     * @returns ToolsOut Successful Response
     * @throws ApiError
     */
    public static readTool({
        providerId,
    }: {
        providerId: number,
    }): CancelablePromise<ToolsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tools/{provider_id}',
            path: {
                'provider_id': providerId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Tool
     * Update a tool.
     * @returns Tool Successful Response
     * @throws ApiError
     */
    public static updateTool({
        toolId,
        requestBody,
    }: {
        toolId: number,
        requestBody: ToolUpdate,
    }): CancelablePromise<Tool> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/tools/{tool_id}',
            path: {
                'tool_id': toolId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Tool
     * Delete a tool.
     * @returns Tool Successful Response
     * @throws ApiError
     */
    public static deleteTool({
        toolId,
    }: {
        toolId: number,
    }): CancelablePromise<Tool> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tools/{tool_id}',
            path: {
                'tool_id': toolId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Validate Tool
     * Validate tool's definition.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static validateTool({
        requestBody,
    }: {
        requestBody: Record<string, any>,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/validate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Invoke Tools
     * Invoke a tool by name with the provided arguments.
     * @returns ToolInvokeResponse Successful Response
     * @throws ApiError
     */
    public static invokeTools({
        toolId,
        toolName,
        requestBody,
    }: {
        toolId: number,
        toolName: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<ToolInvokeResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/invoke',
            query: {
                'tool_id': toolId,
                'tool_name': toolName,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Tool Input Parameters
     * Update a tool's input parameters.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateToolInputParameters({
        toolId,
        requestBody,
    }: {
        toolId: number,
        requestBody: Record<string, any>,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tools/{tool_id}/input-parameters',
            path: {
                'tool_id': toolId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Tool Online Status Endpoint
     * 更新工具在线状态
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateToolOnlineStatusEndpoint({
        toolId,
        isOnline,
    }: {
        toolId: number,
        isOnline: boolean,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tools/{tool_id}/online-status',
            path: {
                'tool_id': toolId,
            },
            query: {
                'is_online': isOnline,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Test Tool
     * 测试工具的可用性
     * @returns any Successful Response
     * @throws ApiError
     */
    public static testTool({
        toolId,
    }: {
        toolId: number,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/{tool_id}/test',
            path: {
                'tool_id': toolId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
