/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ChatMessage } from './ChatMessage';
import type { Interrupt } from './Interrupt';

export type TeamChat = {
    messages: Array<ChatMessage>;
    interrupt?: (Interrupt | null);
};

