/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type TTSRequest = {
    /**
     * The text to convert to speech
     */
    text: string;
    /**
     * The voice type to use
     */
    voice_type?: (string | null);
    /**
     * The audio encoding format
     */
    encoding?: (string | null);
    /**
     * Speech speed ratio
     */
    speed_ratio?: (number | null);
    /**
     * Speech volume ratio
     */
    volume_ratio?: (number | null);
    /**
     * Speech pitch ratio
     */
    pitch_ratio?: (number | null);
    /**
     * Text type (plain or ssml)
     */
    text_type?: (string | null);
    /**
     * Whether to use frontend processing
     */
    with_frontend?: (number | null);
    /**
     * Frontend type
     */
    frontend_type?: (string | null);
};
