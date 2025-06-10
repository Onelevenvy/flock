/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ModelCapability } from './ModelCapability';
import type { ModelCategory } from './ModelCategory';
import type { ModelProviderOut } from './ModelProviderOut';

export type ModelOut = {
    id: number;
    ai_model_name: string;
    categories: Array<ModelCategory>;
    capabilities: Array<ModelCapability>;
    provider: ModelProviderOut;
};
