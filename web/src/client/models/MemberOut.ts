/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Skill } from './Skill';
import type { Upload } from './Upload';

export type MemberOut = {
    name: string;
    backstory?: (string | null);
    role: string;
    type: string;
    owner_of: (number | null);
    position_x: number;
    position_y: number;
    source?: (number | null);
    provider?: string;
    model?: string;
    api_key?: (string | null);
    base_url?: (string | null);
    temperature?: number;
    interrupt?: boolean;
    id: number;
    belongs_to: number;
    skills: Array<Skill>;
    uploads: Array<Upload>;
};

