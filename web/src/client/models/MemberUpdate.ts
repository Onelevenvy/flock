/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Skill } from './Skill';
import type { Upload } from './Upload';

export type MemberUpdate = {
    name?: (string | null);
    backstory?: (string | null);
    role?: (string | null);
    type?: (string | null);
    owner_of?: (number | null);
    position_x?: (number | null);
    position_y?: (number | null);
    source?: (number | null);
    provider?: (string | null);
    model?: (string | null);
    temperature?: (number | null);
    interrupt?: (boolean | null);
    belongs_to?: (number | null);
    skills?: (Array<Skill> | null);
    uploads?: (Array<Upload> | null);
};

