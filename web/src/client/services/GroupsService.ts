/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupCreate } from '../models/GroupCreate';
import type { GroupOut } from '../models/GroupOut';
import type { GroupsOut } from '../models/GroupsOut';
import type { GroupUpdate } from '../models/GroupUpdate';
import type { Message } from '../models/Message';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class GroupsService {

    /**
     * Read Groups
     * Retrieve groups.
     * @returns GroupsOut Successful Response
     * @throws ApiError
     */
    public static readGroups({
        skip,
        limit = 100,
    }: {
        skip?: number,
        limit?: number,
    }): CancelablePromise<GroupsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/groups/',
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
     * Create Group
     * Create new group.
     * @returns GroupOut Successful Response
     * @throws ApiError
     */
    public static createGroup({
        requestBody,
    }: {
        requestBody: GroupCreate,
    }): CancelablePromise<GroupOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/groups/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Group By Id
     * Get a specific group by id.
     * @returns GroupOut Successful Response
     * @throws ApiError
     */
    public static readGroupById({
        groupId,
    }: {
        groupId: number,
    }): CancelablePromise<GroupOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/groups/{group_id}',
            path: {
                'group_id': groupId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Group
     * Update a group.
     * @returns GroupOut Successful Response
     * @throws ApiError
     */
    public static updateGroup({
        groupId,
        requestBody,
    }: {
        groupId: number,
        requestBody: GroupUpdate,
    }): CancelablePromise<GroupOut> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/groups/{group_id}',
            path: {
                'group_id': groupId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Group
     * Delete a group.
     * @returns Message Successful Response
     * @throws ApiError
     */
    public static deleteGroup({
        groupId,
    }: {
        groupId: number,
    }): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/groups/{group_id}',
            path: {
                'group_id': groupId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
