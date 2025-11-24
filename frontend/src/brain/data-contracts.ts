/** Body_upload_image */
export interface BodyUploadImage {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/**
 * QuizData
 * Representerer hele quiz-objektet som lagres.
 */
export interface QuizData {
  /**
   * Data
   * The entire quiz state object.
   */
  data: Record<string, any>;
}

/**
 * UploadResponse
 * Svar som inneholder den offentlige URL-en til den opplastede filen.
 */
export interface UploadResponse {
  /** Url */
  url: string;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type CheckHealthData = HealthResponse;

export type GetUserQuizData = QuizData;

export type SaveUserQuizData = any;

export type SaveUserQuizError = HTTPValidationError;

export type UploadImageData = UploadResponse;

export type UploadImageError = HTTPValidationError;
