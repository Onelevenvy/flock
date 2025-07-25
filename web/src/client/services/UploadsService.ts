/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Body_uploads_create_upload } from '../models/Body_uploads_create_upload';
import type { Body_uploads_update_upload } from '../models/Body_uploads_update_upload';
import type { Message } from '../models/Message';
import type { UploadOut } from '../models/UploadOut';
import type { UploadsOut } from '../models/UploadsOut';
import type { UploadStatus } from '../models/UploadStatus';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class UploadsService {

    /**
     * Read Uploads
     * Retrieve uploads.
     * @returns UploadsOut Successful Response
     * @throws ApiError
     */
    public static readUploads({
        status,
        skip,
        limit = 100,
    }: {
        status?: (UploadStatus | null),
        skip?: number,
        limit?: number,
    }): CancelablePromise<UploadsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/uploads/',
            query: {
                'status': status,
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Create Upload
     * Create upload
     * @returns UploadOut Successful Response
     * @throws ApiError
     */
    public static createUpload({
        formData,
    }: {
        formData: Body_uploads_create_upload,
    }): CancelablePromise<UploadOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/uploads/',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Upload
     * Update upload
     * @returns UploadOut Successful Response
     * @throws ApiError
     */
    public static updateUpload({
        id,
        contentLength,
        formData,
    }: {
        id: number,
        contentLength: number,
        formData?: Body_uploads_update_upload,
    }): CancelablePromise<UploadOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/uploads/{id}',
            path: {
                'id': id,
            },
            headers: {
                'content-length': contentLength,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Upload
     * Delete upload
     * @returns Message Successful Response
     * @throws ApiError
     */
    public static deleteUpload({
        id,
    }: {
        id: number,
    }): CancelablePromise<Message> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/uploads/{id}',
            path: {
                'id': id,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Search Upload
     * Initiate an asynchronous search within a specific upload.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static searchUpload({
        uploadId,
        requestBody,
    }: {
        uploadId: number,
        requestBody: Record<string, any>,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/uploads/{upload_id}/search',
            path: {
                'upload_id': uploadId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Get Search Results
     * Retrieve the results of an asynchronous search task.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getSearchResults({
        taskId,
        uploadId,
    }: {
        taskId: string,
        uploadId: number,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/uploads/{upload_id}/search/{task_id}',
            path: {
                'task_id': taskId,
                'upload_id': uploadId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
