/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Group } from './Group';
import type { Role } from './Role';

export type UserOut = {
    email: string;
    is_active?: boolean;
    is_superuser?: boolean;
    full_name?: (string | null);
    language?: string;
    id: number;
    groups?: (Array<Group> | null);
    roles?: (Array<Role> | null);
};

