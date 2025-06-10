/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MemberCreate } from '../models/MemberCreate';
import type { MemberOut } from '../models/MemberOut';
import type { MembersOut } from '../models/MembersOut';
import type { MemberUpdate } from '../models/MemberUpdate';
import type { Message } from '../models/Message';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class MembersService {

    /**
     * Read Members
     * Retrieve members from team.
     * @returns MembersOut Successful Response
     * @throws ApiError
     */
    public static readMembers({
teamId,
skip,
limit = 100,
}: {
teamId: number,
skip?: number,
limit?: number,
}): CancelablePromise<MembersOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/members/',
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
     * Create Member
     * Create new member.
     * @returns MemberOut Successful Response
     * @throws ApiError
     */
    public static createMember({
teamId,
requestBody,
}: {
teamId: number,
requestBody: MemberCreate,
}): CancelablePromise<MemberOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/members/',
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
     * Read Member
     * Get member by ID.
     * @returns MemberOut Successful Response
     * @throws ApiError
     */
    public static readMember({
teamId,
id,
}: {
teamId: number,
id: number,
}): CancelablePromise<MemberOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{team_id}/members/{id}',
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
     * Update Member
     * Update a member.
     * @returns MemberOut Successful Response
     * @throws ApiError
     */
    public static updateMember({
teamId,
id,
requestBody,
}: {
teamId: number,
id: number,
requestBody: MemberUpdate,
}): CancelablePromise<MemberOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/teams/{team_id}/members/{id}',
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
     * Delete Member
     * Delete a member.
     * @returns Message Successful Response
     * @throws ApiError
     */
    public static deleteMember({
teamId,
id,
}: {
teamId: number,
id: number,
}): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{team_id}/members/{id}',
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
