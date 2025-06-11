/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ThreadCreate } from '../models/ThreadCreate';
import type { ThreadOut } from '../models/ThreadOut';
import type { ThreadRead } from '../models/ThreadRead';
import type { ThreadsOut } from '../models/ThreadsOut';
import type { ThreadUpdate } from '../models/ThreadUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ThreadsService {

    /**
     * Read Threads
     * Retrieve threads
     * @returns ThreadsOut Successful Response
     * @throws ApiError
     */
    public static readThreads({
teamId,
skip,
limit = 100,
}: {
teamId: number,
skip?: number,
limit?: number,
}): CancelablePromise<ThreadsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/threads/',
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
     * Create Thread
     * Create new thread
     * @returns ThreadOut Successful Response
     * @throws ApiError
     */
    public static createThread({
teamId,
requestBody,
}: {
teamId: number,
requestBody: ThreadCreate,
}): CancelablePromise<ThreadOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/threads/',
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
     * Read Thread
     * Get thread and its last checkpoint by ID
     * @returns ThreadRead Successful Response
     * @throws ApiError
     */
    public static readThread({
teamId,
id,
}: {
teamId: number,
id: string,
}): CancelablePromise<ThreadRead> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/threads/{id}',
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
     * Update Thread
     * Update a thread.
     * @returns ThreadOut Successful Response
     * @throws ApiError
     */
    public static updateThread({
teamId,
id,
requestBody,
}: {
teamId: number,
id: string,
requestBody: ThreadUpdate,
}): CancelablePromise<ThreadOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/teams/{team_id}/threads/{id}',
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
     * Delete Thread
     * Delete a thread.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteThread({
teamId,
id,
}: {
teamId: number,
id: string,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{team_id}/threads/{id}',
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
     * Read Thread Public
     * Get thread and its last checkpoint by ID
     * @returns ThreadRead Successful Response
     * @throws ApiError
     */
    public static readThreadPublic({
threadId,
teamId,
}: {
threadId: string,
teamId: number,
}): CancelablePromise<ThreadRead> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/threads/public/{thread_id}',
            path: {
                'thread_id': threadId,
                'team_id': teamId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
