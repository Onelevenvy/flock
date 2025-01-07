/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { InterruptDecision } from './InterruptDecision';
import type { InterruptType } from './InterruptType';

export type Interrupt = {
    interrupt_type?: (InterruptType | null);
    decision: InterruptDecision;
    tool_message?: (string | null);
};

