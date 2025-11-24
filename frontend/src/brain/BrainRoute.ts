import {
  BodyUploadImage,
  CheckHealthData,
  GetUserQuizData,
  QuizData,
  SaveUserQuizData,
  UploadImageData,
} from "./data-contracts";

export namespace Brain {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * @description Henter quiz-data for den innloggede brukeren. Returnerer 404 hvis ingen quiz er lagret for brukeren.
   * @tags Quiz Storage, dbtn/module:quiz_storage
   * @name get_user_quiz
   * @summary Hent brukerens lagrede quiz
   * @request GET:/routes/quiz
   */
  export namespace get_user_quiz {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetUserQuizData;
  }

  /**
   * @description Lagrer (oppretter eller oppdaterer) quiz-data for den innloggede brukeren. Bruker en "upsert"-operasjon.
   * @tags Quiz Storage, dbtn/module:quiz_storage
   * @name save_user_quiz
   * @summary Lagre eller oppdater brukerens quiz
   * @request PUT:/routes/quiz
   */
  export namespace save_user_quiz {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = QuizData;
    export type RequestHeaders = {};
    export type ResponseBody = SaveUserQuizData;
  }

  /**
   * @description Laster opp et bilde, lagrer det som en statisk fil (static asset), og returnerer den offentlige, permanente URL-en.
   * @tags dbtn/module:image_upload, dbtn/hasAuth
   * @name upload_image
   * @summary Upload Image
   * @request POST:/routes/upload_image
   */
  export namespace upload_image {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = BodyUploadImage;
    export type RequestHeaders = {};
    export type ResponseBody = UploadImageData;
  }
}
