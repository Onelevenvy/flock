/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SkillCreate } from '../models/SkillCreate';
import type { SkillOut } from '../models/SkillOut';
import type { SkillsOut } from '../models/SkillsOut';
import type { SkillUpdate } from '../models/SkillUpdate';
import type { ToolDefinitionValidate } from '../models/ToolDefinitionValidate';
import type { ToolInvokeResponse } from '../models/ToolInvokeResponse';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ToolsService {

    /**
     * Read Skills
     * Retrieve skills
     * @returns SkillsOut Successful Response
     * @throws ApiError
     */
    public static readSkills({
skip,
limit = 100,
}: {
skip?: number,
limit?: number,
}): CancelablePromise<SkillsOut> {
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
     * Create Skill
     * Create new skill.
     * @returns SkillOut Successful Response
     * @throws ApiError
     */
    public static createSkill({
requestBody,
}: {
requestBody: SkillCreate,
}): CancelablePromise<SkillOut> {
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
     * Read Skill
     * Get skill by ID.
     * @returns SkillOut Successful Response
     * @throws ApiError
     */
    public static readSkill({
id,
}: {
id: number,
}): CancelablePromise<SkillOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tools/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Skill
     * Update a skill.
     * @returns SkillOut Successful Response
     * @throws ApiError
     */
    public static updateSkill({
id,
requestBody,
}: {
id: number,
requestBody: SkillUpdate,
}): CancelablePromise<SkillOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/tools/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Skill
     * Delete a skill.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteSkill({
id,
}: {
id: number,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tools/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Validate Skill
     * Validate skill's tool definition.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static validateSkill({
requestBody,
}: {
requestBody: ToolDefinitionValidate,
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
toolName,
requestBody,
}: {
toolName: string,
requestBody: Record<string, any>,
}): CancelablePromise<ToolInvokeResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/invoke-tool',
            query: {
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
     * Update Skill Credentials
     * Update a skill's credentials.
     * @returns SkillOut Successful Response
     * @throws ApiError
     */
    public static updateSkillCredentials({
id,
requestBody,
}: {
id: number,
requestBody: Record<string, Record<string, any>>,
}): CancelablePromise<SkillOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/update-credentials/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Get Mcp Tools
     * 获取MCP服务器的工具列表
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getMcpTools({
requestBody,
}: {
requestBody: Record<string, any>,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tools/mcp/tools',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
