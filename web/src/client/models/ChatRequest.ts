/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { app__core__langmanus__server__chat_request__ChatMessage } from './app__core__langmanus__server__chat_request__ChatMessage';
import type { Resource } from './Resource';

export type ChatRequest = {
    /**
     * History of messages between the user and the assistant
     */
    messages?: (Array<app__core__langmanus__server__chat_request__ChatMessage> | null);
    /**
     * Resources to be used for the research
     */
    resources?: (Array<Resource> | null);
    /**
     * Whether to enable debug logging
     */
    debug?: (boolean | null);
    /**
     * A specific conversation identifier
     */
    thread_id?: (string | null);
    /**
     * The maximum number of plan iterations
     */
    max_plan_iterations?: (number | null);
    /**
     * The maximum number of steps in a plan
     */
    max_step_num?: (number | null);
    /**
     * The maximum number of search results
     */
    max_search_results?: (number | null);
    /**
     * Whether to automatically accept the plan
     */
    auto_accepted_plan?: (boolean | null);
    /**
     * Interrupt feedback from the user on the plan
     */
    interrupt_feedback?: (string | null);
    /**
     * MCP settings for the chat request
     */
    mcp_settings?: (Record<string, any> | null);
    /**
     * Whether to get background investigation before plan
     */
    enable_background_investigation?: (boolean | null);
};
