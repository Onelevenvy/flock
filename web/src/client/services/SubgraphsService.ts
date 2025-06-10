/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Message } from '../models/Message';
import type { SubgraphCreate } from '../models/SubgraphCreate';
import type { SubgraphOut } from '../models/SubgraphOut';
import type { SubgraphsOut } from '../models/SubgraphsOut';
import type { SubgraphUpdate } from '../models/SubgraphUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class SubgraphsService {

    /**
     * Read Subgraphs
     * Retrieve subgraphs.
     * @returns SubgraphsOut Successful Response
     * @throws ApiError
     */
    public static readSubgraphs({
teamId,
skip,
limit = 100,
}: {
teamId: (number | null),
skip?: number,
limit?: number,
}): CancelablePromise<SubgraphsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/subgraphs/',
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
     * Create Subgraph
     * Create new subgraph.
     * @returns SubgraphOut Successful Response
     * @throws ApiError
     */
    public static createSubgraph({
requestBody,
}: {
requestBody: SubgraphCreate,
}): CancelablePromise<SubgraphOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/subgraphs/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Subgraph
     * Get subgraph by ID.
     * @returns SubgraphOut Successful Response
     * @throws ApiError
     */
    public static readSubgraph({
id,
}: {
id: number,
}): CancelablePromise<SubgraphOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/subgraphs/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Subgraph
     * Update subgraph by ID.
     * @returns SubgraphOut Successful Response
     * @throws ApiError
     */
    public static updateSubgraph({
id,
requestBody,
}: {
id: number,
requestBody: SubgraphUpdate,
}): CancelablePromise<SubgraphOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/teams/{team_id}/subgraphs/{id}',
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
     * Delete Subgraph
     * Delete subgraph by ID.
     * @returns Message Successful Response
     * @throws ApiError
     */
    public static deleteSubgraph({
id,
}: {
id: number,
}): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{team_id}/subgraphs/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read All Public Subgraphs
     * Retrieve all public subgraphs.
     * @returns SubgraphsOut Successful Response
     * @throws ApiError
     */
    public static readAllPublicSubgraphs({
skip,
limit = 100,
}: {
skip?: number,
limit?: number,
}): CancelablePromise<SubgraphsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/subgraphs/all',
            query: {
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
