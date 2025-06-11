/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ContentItem } from './ContentItem';

export type app__core__langmanus__server__chat_request__ChatMessage = {
    /**
     * The role of the message sender (user or assistant)
     */
    role: string;
    /**
     * The content of the message, either a string or a list of content items
     */
    content: (string | Array<ContentItem>);
};
