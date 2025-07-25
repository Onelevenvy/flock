/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MCPConnectionTest } from '../models/MCPConnectionTest';
import type { MCPProviderCreate } from '../models/MCPProviderCreate';
import type { MCPProviderOut } from '../models/MCPProviderOut';
import type { MCPProviderUpdate } from '../models/MCPProviderUpdate';
import type { ProvidersListWithToolsOut } from '../models/ProvidersListWithToolsOut';
import type { ToolProvider } from '../models/ToolProvider';
import type { ToolProviderCreate } from '../models/ToolProviderCreate';
import type { ToolProviderOut } from '../models/ToolProviderOut';
import type { ToolProviderUpdate } from '../models/ToolProviderUpdate';
import type { ToolProviderWithToolsListOut } from '../models/ToolProviderWithToolsListOut';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ToolproviderService {

    /**
     * Read Provider List With Tools
     * @returns ProvidersListWithToolsOut Successful Response
     * @throws ApiError
     */
    public static readProviderListWithTools(): CancelablePromise<ProvidersListWithToolsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/toolprovider/',
        });
    }

    /**
     * Create Provider
     * @returns ToolProvider Successful Response
     * @throws ApiError
     */
    public static createProvider({
        requestBody,
    }: {
        requestBody: ToolProviderCreate,
    }): CancelablePromise<ToolProvider> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/toolprovider/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Provider
     * Get provider by ID.
     * @returns ToolProviderOut Successful Response
     * @throws ApiError
     */
    public static readProvider({
        toolProviderId,
    }: {
        toolProviderId: number,
    }): CancelablePromise<ToolProviderOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/toolprovider/{tool_provider_id}',
            path: {
                'tool_provider_id': toolProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Provider
     * Update a provider.
     * @returns ToolProviderOut Successful Response
     * @throws ApiError
     */
    public static updateProvider({
        toolProviderId,
        requestBody,
    }: {
        toolProviderId: number,
        requestBody: ToolProviderUpdate,
    }): CancelablePromise<ToolProviderOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/toolprovider/{tool_provider_id}',
            path: {
                'tool_provider_id': toolProviderId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Provider
     * 删除工具提供者
     * @returns ToolProviderOut Successful Response
     * @throws ApiError
     */
    public static deleteProvider({
        toolProviderId,
    }: {
        toolProviderId: number,
    }): CancelablePromise<ToolProviderOut> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/toolprovider/{tool_provider_id}',
            path: {
                'tool_provider_id': toolProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Provider With Tools
     * @returns ToolProviderWithToolsListOut Successful Response
     * @throws ApiError
     */
    public static readProviderWithTools({
        toolProviderId,
    }: {
        toolProviderId: number,
    }): CancelablePromise<ToolProviderWithToolsListOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/toolprovider/withtools/{tool_provider_id}',
            path: {
                'tool_provider_id': toolProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Authenticate Provider
     * 对工具提供商进行鉴权或刷新工具列表
     * @returns any Successful Response
     * @throws ApiError
     */
    public static authenticateProvider({
        toolProviderId,
    }: {
        toolProviderId: number,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/toolprovider/{tool_provider_id}/authenticate',
            path: {
                'tool_provider_id': toolProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Create Mcp Provider
     * 创建 MCP 工具提供者并同步工具
     * @returns MCPProviderOut Successful Response
     * @throws ApiError
     */
    public static createMcpProvider({
        requestBody,
    }: {
        requestBody: MCPProviderCreate,
    }): CancelablePromise<MCPProviderOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/toolprovider/mcp',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Mcp Provider
     * 更新 MCP 工具提供者并同步工具
     * @returns MCPProviderOut Successful Response
     * @throws ApiError
     */
    public static updateMcpProvider({
        toolProviderId,
        requestBody,
    }: {
        toolProviderId: number,
        requestBody: MCPProviderUpdate,
    }): CancelablePromise<MCPProviderOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/toolprovider/mcp/{tool_provider_id}',
            path: {
                'tool_provider_id': toolProviderId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Test Mcp Connection
     * 测试 MCP 连接
     * @returns any Successful Response
     * @throws ApiError
     */
    public static testMcpConnection({
        requestBody,
    }: {
        requestBody: MCPConnectionTest,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/toolprovider/mcp/test-connection',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Sync Mcp Tools
     * 同步 MCP 工具
     * @returns any Successful Response
     * @throws ApiError
     */
    public static syncMcpTools({
        toolProviderId,
    }: {
        toolProviderId: number,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/toolprovider/mcp/{tool_provider_id}/sync',
            path: {
                'tool_provider_id': toolProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
