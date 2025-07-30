/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { UserOut } from './UserOut';

/**
 * Schema for group output
 */
export type GroupOut = {
    name: string;
    description?: (string | null);
    is_system_group?: boolean;
    admin_id: (number | null);
    id: number;
    admin: (UserOut | null);
};

