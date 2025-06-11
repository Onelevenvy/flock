/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { app__models__ChatMessage } from "./app__models__ChatMessage";
import type { Interrupt } from "./Interrupt";

export type TeamChat = {
  messages: Array<app__models__ChatMessage>;
  interrupt?: Interrupt | null;
};
