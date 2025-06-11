/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ContentItem = {
    /**
     * The type of content (text, image, etc.)
     */
    type: string;
    /**
     * The text content if type is 'text'
     */
    text?: (string | null);
    /**
     * The image URL if type is 'image'
     */
    image_url?: (string | null);
};
