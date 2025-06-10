/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ModelOutIdWithAndName } from './ModelOutIdWithAndName';

export type ModelProviderWithModelsListOut = {
    id: number;
    provider_name: string;
    base_url: (string | null);
    api_key: (string | null);
    icon: (string | null);
    description: (string | null);
    models: Array<ModelOutIdWithAndName>;
};
