/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TeamChat } from '../models/TeamChat';
import type { TeamChatPublic } from '../models/TeamChatPublic';
import type { TeamCreate } from '../models/TeamCreate';
import type { TeamOut } from '../models/TeamOut';
import type { TeamsOut } from '../models/TeamsOut';
import type { TeamUpdate } from '../models/TeamUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class TeamsService {

    /**
     * Read Teams
     * Retrieve teams
     * @returns TeamsOut Successful Response
     * @throws ApiError
     */
    public static readTeams({
        skip,
        limit = 100,
    }: {
        skip?: number,
        limit?: number,
    }): CancelablePromise<TeamsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/',
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
     * Create Team
     * Create new team and it's team leader
     * @returns TeamOut Successful Response
     * @throws ApiError
     */
    public static createTeam({
        requestBody,
    }: {
        requestBody: TeamCreate,
    }): CancelablePromise<TeamOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Team
     * Get team by ID.
     * @returns TeamOut Successful Response
     * @throws ApiError
     */
    public static readTeam({
        id,
    }: {
        id: number,
    }): CancelablePromise<TeamOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/teams/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Team
     * Update a team.
     * @returns TeamOut Successful Response
     * @throws ApiError
     */
    public static updateTeam({
        id,
        requestBody,
    }: {
        id: number,
        requestBody: TeamUpdate,
    }): CancelablePromise<TeamOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/teams/{id}',
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
     * Delete Team
     * Delete a team.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteTeam({
        id,
    }: {
        id: number,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/teams/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Stream
     * Stream a response to a user's input.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static stream({
        id,
        threadId,
        requestBody,
    }: {
        id: number,
        threadId: string,
        requestBody: TeamChat,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{id}/stream/{thread_id}',
            path: {
                'id': id,
                'thread_id': threadId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Public Stream
     * Stream a response from a team using a given message or an interrupt decision. Requires an API key for authentication.
     * This endpoint allows streaming responses from a team based on a provided message or interrupt details. The request must include an API key for authorization.
     * Parameters:
     * - `team_id` (int): The ID of the team to which the message is being sent. Must be a valid team ID.
     * - `thread_id` (str): The ID of the thread where the message will be posted. If the thread ID does not exist, a new thread will be created.
     * Request Body (JSON):
     * - The request body should be a JSON object containing either the `message` or `interrupt` field:
     * - `message` (object, optional): The message to be sent to the team.
     * - `type` (str): Must be `"human"`.
     * - `content` (str): The content of the message to be sent.
     * - `interrupt` (object, optional): Approve/reject tool or reply to an ask-human tool.
     * - `decision` (str): Can be `'approved'`, `'rejected'`, or `'replied'`.
     * - `tool_message` (str or null, optional): If `decision` is `'rejected'` or `'replied'`, provide a message explaining the reason for rejection or the reply.
     * Authorization:
     * - API key must be provided in the request header as `x-api-key`.
     * Responses:
     * - `200 OK`: Returns a streaming response in `text/event-stream` format containing the team's response.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static publicStream({
        teamId,
        threadId,
        requestBody,
    }: {
        teamId: number,
        threadId: string,
        requestBody: TeamChatPublic,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/teams/{team_id}/stream-public/{thread_id}',
            path: {
                'team_id': teamId,
                'thread_id': threadId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
