/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiKeyCreate } from '../models/ApiKeyCreate';
import type { ApiKeyOut } from '../models/ApiKeyOut';
import type { ApiKeysOutPublic } from '../models/ApiKeysOutPublic';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ApiKeysService {

    /**
     * Read Api Keys
     * Read api keys
     * @returns ApiKeysOutPublic Successful Response
     * @throws ApiError
     */
    public static readApiKeys({
        teamId,
        skip,
        limit = 100,
    }: {
        teamId: number,
        skip?: number,
        limit?: number,
    }): CancelablePromise<ApiKeysOutPublic> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/api-keys/',
            path: {
                'team_id': teamId,
            },
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
     * Create Api Key
     * Create API key for a team.
     * @returns ApiKeyOut Successful Response
     * @throws ApiError
     */
    public static createApiKey({
        teamId,
        requestBody,
    }: {
        teamId: number,
        requestBody: ApiKeyCreate,
    }): CancelablePromise<ApiKeyOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/api-keys/',
            path: {
                'team_id': teamId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Api Key
     * Delete API key for a team.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteApiKey({
        teamId,
        id,
    }: {
        teamId: number,
        id: number,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{team_id}/api-keys/{id}',
            path: {
                'team_id': teamId,
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
