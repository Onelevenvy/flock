/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { UploadStatus } from './UploadStatus';

export type Upload = {
    name: string;
    description: string;
    file_type: string;
    web_url?: (string | null);
    id?: (number | null);
    resource_id: number;
    owner_id?: (number | null);
    last_modified?: string;
    status: UploadStatus;
    chunk_size: number;
    chunk_overlap: number;
};

