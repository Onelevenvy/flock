/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Message } from '../models/Message';
import type { RoleCreate } from '../models/RoleCreate';
import type { RoleOut } from '../models/RoleOut';
import type { RolesOut } from '../models/RolesOut';
import type { RoleUpdate } from '../models/RoleUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class RolesService {

    /**
     * Read Roles
     * Retrieve roles.
     * @returns RolesOut Successful Response
     * @throws ApiError
     */
    public static readRoles({
        skip,
        limit = 100,
    }: {
        skip?: number,
        limit?: number,
    }): CancelablePromise<RolesOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/roles/',
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
     * Create Role
     * Create new role.
     * @returns RoleOut Successful Response
     * @throws ApiError
     */
    public static createRole({
        requestBody,
    }: {
        requestBody: RoleCreate,
    }): CancelablePromise<RoleOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/roles/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Role By Id
     * Get a specific role by id.
     * @returns RoleOut Successful Response
     * @throws ApiError
     */
    public static readRoleById({
        roleId,
    }: {
        roleId: number,
    }): CancelablePromise<RoleOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/roles/{role_id}',
            path: {
                'role_id': roleId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Role
     * Update a role.
     * @returns RoleOut Successful Response
     * @throws ApiError
     */
    public static updateRole({
        roleId,
        requestBody,
    }: {
        roleId: number,
        requestBody: RoleUpdate,
    }): CancelablePromise<RoleOut> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/roles/{role_id}',
            path: {
                'role_id': roleId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Role
     * Delete a role.
     * @returns Message Successful Response
     * @throws ApiError
     */
    public static deleteRole({
        roleId,
    }: {
        roleId: number,
    }): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/roles/{role_id}',
            path: {
                'role_id': roleId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
