/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatRequest } from '../models/ChatRequest';
import type { GeneratePodcastRequest } from '../models/GeneratePodcastRequest';
import type { GeneratePPTRequest } from '../models/GeneratePPTRequest';
import type { GenerateProseRequest } from '../models/GenerateProseRequest';
import type { MCPServerMetadataRequest } from '../models/MCPServerMetadataRequest';
import type { MCPServerMetadataResponse } from '../models/MCPServerMetadataResponse';
import type { QuestionRequest } from '../models/QuestionRequest';
import type { RAGConfigResponse } from '../models/RAGConfigResponse';
import type { RAGResourcesResponse } from '../models/RAGResourcesResponse';
import type { TTSRequest } from '../models/TTSRequest';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class LangmanusService {

    /**
     * Ask Question
     * @returns any Successful Response
     * @throws ApiError
     */
    public static askQuestion({
requestBody,
}: {
requestBody: QuestionRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/ask',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Chat Stream
     * @returns any Successful Response
     * @throws ApiError
     */
    public static chatStream({
requestBody,
}: {
requestBody: ChatRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/chat/stream',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Text To Speech
     * Convert text to speech using volcengine TTS API.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static textToSpeech({
requestBody,
}: {
requestBody: TTSRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/tts',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Generate Podcast
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generatePodcast({
requestBody,
}: {
requestBody: GeneratePodcastRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/podcast/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Generate Ppt
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generatePpt({
requestBody,
}: {
requestBody: GeneratePPTRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/ppt/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Generate Prose
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateProse({
requestBody,
}: {
requestBody: GenerateProseRequest,
}): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/prose/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Mcp Server Metadata
     * @returns MCPServerMetadataResponse Successful Response
     * @throws ApiError
     */
    public static mcpServerMetadata({
requestBody,
}: {
requestBody: MCPServerMetadataRequest,
}): CancelablePromise<MCPServerMetadataResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/langmanus/mcp/server/metadata',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Rag Config
     * @returns RAGConfigResponse Successful Response
     * @throws ApiError
     */
    public static ragConfig(): CancelablePromise<RAGConfigResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/langmanus/rag/config',
        });
    }

    /**
     * Rag Resources
     * @returns RAGResourcesResponse Successful Response
     * @throws ApiError
     */
    public static ragResources({
query,
}: {
/**
 * The query of the resource need to be searched
 */
query?: (string | null),
}): CancelablePromise<RAGResourcesResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/langmanus/rag/resources',
            query: {
                'query': query,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
