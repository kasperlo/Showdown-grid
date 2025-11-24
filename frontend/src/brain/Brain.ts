import {
  BodyUploadImage,
  CheckHealthData,
  GetUserQuizData,
  QuizData,
  SaveUserQuizData,
  SaveUserQuizError,
  UploadImageData,
  UploadImageError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Henter quiz-data for den innloggede brukeren. Returnerer 404 hvis ingen quiz er lagret for brukeren.
   *
   * @tags Quiz Storage, dbtn/module:quiz_storage
   * @name get_user_quiz
   * @summary Hent brukerens lagrede quiz
   * @request GET:/routes/quiz
   */
  get_user_quiz = (params: RequestParams = {}) =>
    this.request<GetUserQuizData, any>({
      path: `/routes/quiz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Lagrer (oppretter eller oppdaterer) quiz-data for den innloggede brukeren. Bruker en "upsert"-operasjon.
   *
   * @tags Quiz Storage, dbtn/module:quiz_storage
   * @name save_user_quiz
   * @summary Lagre eller oppdater brukerens quiz
   * @request PUT:/routes/quiz
   */
  save_user_quiz = (data: QuizData, params: RequestParams = {}) =>
    this.request<SaveUserQuizData, SaveUserQuizError>({
      path: `/routes/quiz`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Laster opp et bilde, lagrer det som en statisk fil (static asset), og returnerer den offentlige, permanente URL-en.
   *
   * @tags dbtn/module:image_upload, dbtn/hasAuth
   * @name upload_image
   * @summary Upload Image
   * @request POST:/routes/upload_image
   */
  upload_image = (data: BodyUploadImage, params: RequestParams = {}) =>
    this.request<UploadImageData, UploadImageError>({
      path: `/routes/upload_image`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      ...params,
    });
}
