/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ModelCapability } from './ModelCapability';
import type { ModelCategory } from './ModelCategory';

export type ModelCreate = {
    ai_model_name: string;
    provider_id: number;
    categories: Array<ModelCategory>;
    capabilities?: Array<ModelCapability>;
    meta_?: (Record<string, any> | null);
};
