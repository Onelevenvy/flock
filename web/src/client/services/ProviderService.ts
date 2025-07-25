/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ModelProvider } from '../models/ModelProvider';
import type { ModelProviderCreate } from '../models/ModelProviderCreate';
import type { ModelProviderOut } from '../models/ModelProviderOut';
import type { ModelProviderUpdate } from '../models/ModelProviderUpdate';
import type { ModelProviderWithModelsListOut } from '../models/ModelProviderWithModelsListOut';
import type { ProvidersListWithModelsOut } from '../models/ProvidersListWithModelsOut';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ProviderService {

    /**
     * Read Provider List With Models
     * @returns ProvidersListWithModelsOut Successful Response
     * @throws ApiError
     */
    public static readProviderListWithModels(): CancelablePromise<ProvidersListWithModelsOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/provider/',
        });
    }

    /**
     * Create Provider
     * @returns ModelProvider Successful Response
     * @throws ApiError
     */
    public static createProvider({
        requestBody,
    }: {
        requestBody: ModelProviderCreate,
    }): CancelablePromise<ModelProvider> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/provider/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Provider
     * Get provider by ID.
     * @returns ModelProviderOut Successful Response
     * @throws ApiError
     */
    public static readProvider({
        modelProviderId,
    }: {
        modelProviderId: number,
    }): CancelablePromise<ModelProviderOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/provider/{model_provider_id}',
            path: {
                'model_provider_id': modelProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Update Provider
     * Update a provider.
     * @returns ModelProviderOut Successful Response
     * @throws ApiError
     */
    public static updateProvider({
        modelProviderId,
        requestBody,
    }: {
        modelProviderId: number,
        requestBody: ModelProviderUpdate,
    }): CancelablePromise<ModelProviderOut> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/provider/{model_provider_id}',
            path: {
                'model_provider_id': modelProviderId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Delete Provider
     * @returns ModelProvider Successful Response
     * @throws ApiError
     */
    public static deleteProvider({
        modelProviderId,
    }: {
        modelProviderId: number,
    }): CancelablePromise<ModelProvider> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/provider/{model_provider_id}',
            path: {
                'model_provider_id': modelProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Read Provider With Models
     * @returns ModelProviderWithModelsListOut Successful Response
     * @throws ApiError
     */
    public static readProviderWithModels({
        modelProviderId,
    }: {
        modelProviderId: number,
    }): CancelablePromise<ModelProviderWithModelsListOut> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/provider/withmodels/{model_provider_id}',
            path: {
                'model_provider_id': modelProviderId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Sync Provider
     * 从配置文件同步提供者的模型到数据库
     * 返回同步的模型名称列表
     * @returns string Successful Response
     * @throws ApiError
     */
    public static syncProvider({
        providerName,
    }: {
        providerName: string,
    }): CancelablePromise<Array<string>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/provider/{provider_name}/sync',
            path: {
                'provider_name': providerName,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
