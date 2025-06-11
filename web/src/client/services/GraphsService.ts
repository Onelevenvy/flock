/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GraphCreate } from '../models/GraphCreate';
import type { GraphOut } from '../models/GraphOut';
import type { GraphsOut } from '../models/GraphsOut';
import type { GraphUpdate } from '../models/GraphUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class GraphsService {

    /**
     * Read Graphs
     * Retrieve graphs from team.
     * @returns GraphsOut Successful Response
     * @throws ApiError
     */
    public static readGraphs({
teamId,
skip,
limit = 100,
}: {
teamId: number,
skip?: number,
limit?: number,
}): CancelablePromise<GraphsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/graphs/',
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
     * Create Graph
     * Create new graph.
     * @returns GraphOut Successful Response
     * @throws ApiError
     */
    public static createGraph({
teamId,
requestBody,
}: {
teamId: number,
requestBody: GraphCreate,
}): CancelablePromise<GraphOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/graphs/',
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
     * Read Graph
     * Get graph by ID.
     * @returns GraphOut Successful Response
     * @throws ApiError
     */
    public static readGraph({
teamId,
id,
}: {
teamId: number,
id: number,
}): CancelablePromise<GraphOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/graphs/{id}',
            path: {
                'team_id': teamId,
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Graph
     * Update graph by ID.
     * @returns GraphOut Successful Response
     * @throws ApiError
     */
    public static updateGraph({
teamId,
id,
requestBody,
}: {
teamId: number,
id: number,
requestBody: GraphUpdate,
}): CancelablePromise<GraphOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/teams/{team_id}/graphs/{id}',
            path: {
                'team_id': teamId,
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
     * Delete Graph
     * Delete graph by ID.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteGraph({
teamId,
id,
}: {
teamId: number,
id: number,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{team_id}/graphs/{id}',
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
