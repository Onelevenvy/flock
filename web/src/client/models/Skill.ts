/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Skill = {
    name: string;
    description: string;
    display_name?: (string | null);
    managed?: boolean;
    tool_definition?: (Record<string, any> | null);
    input_parameters?: (Record<string, any> | null);
    credentials?: (Record<string, any> | null);
    id?: (number | null);
    resource_id: number;
    owner_id?: (number | null);
};
