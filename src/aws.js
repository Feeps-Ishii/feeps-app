import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { CookieStorage } from "aws-amplify/utils";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-northeast-1_QG4KZb06z",
      userPoolClientId: "280tvccus7fe6kc6uhvsjs9n4g",
    },
  },
});

// 共通ログイン（2026-10-12、ADR 0026）：app.devhub-lms.com（DevHub LMS）と learn.devhub-lms.com（DevHub Learning）は
// 別のサイトなので、ふつうの保存先（localStorage）ではログインが共有されない。devhub-lms.com で開いたときだけ、
// ログインの情報を .devhub-lms.com の Cookie に置き、どちらで入っても、もう片方にそのまま入れるようにする。
// それ以外（今の CloudFront のアドレス・ローカル）は今までどおり localStorage。
if (typeof window !== "undefined" && /(^|\.)devhub-lms\.com$/.test(window.location.hostname)) {
  cognitoUserPoolsTokenProvider.setKeyValueStorage(new CookieStorage({
    domain: ".devhub-lms.com",
    path: "/",
    expires: 30,
    secure: true,
    sameSite: "lax",
  }));
}
