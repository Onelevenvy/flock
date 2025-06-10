/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { UploadStatus } from './UploadStatus';

export type UploadOut = {
    name: string;
    description: string;
    file_type: string;
    web_url: (string | null);
    id: number;
    last_modified: string;
    status: UploadStatus;
    owner_id?: (number | null);
    chunk_size: number;
    chunk_overlap: number;
};
