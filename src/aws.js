import { Amplify } from "aws-amplify";
import "aws-amplify/auth/enable-oauth-listener";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { CookieStorage } from "aws-amplify/utils";

// Google のログイン（2026-10-17、ADR 0028）。Cognito に Google をつなぎ、戻り先の URL を登録してから true にする
// （手順: docs/operations/google-login-setup.md）。false のあいだは、ボタンも OAuth の設定も出さない
export const GOOGLE_LOGIN = false;

// 画面への合図（チャット・ボードの新着。AppSync Events、2026-10-25、ADR 0032）。
// sam deploy の出力 RealtimeHttpDomain を入れる。空のあいだは合図を使わず、画面は60秒ごとの問い合わせで動く（src/realtime.js）
export const REALTIME_HTTP_DOMAIN = "wm6b77lerzcrvlawtcgnkbpfzm.appsync-api.ap-northeast-1.amazonaws.com";

// 戻り先は「いま開いているページ」。Cognito のアプリクライアントに同じ URL を登録しておく
const here = typeof window === "undefined" ? "" : window.location.origin + (window.location.pathname === "/index.html" ? "/" : window.location.pathname || "/");

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-northeast-1_QG4KZb06z",
      userPoolClientId: "280tvccus7fe6kc6uhvsjs9n4g",
      ...(GOOGLE_LOGIN && here ? {
        loginWith: {
          email: true,
          oauth: {
            domain: "ap-northeast-1qg4kzb06z.auth.ap-northeast-1.amazoncognito.com",
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [here],
            redirectSignOut: [here],
            responseType: "code",
          },
        },
      } : {}),
    },
  },
  ...(REALTIME_HTTP_DOMAIN ? {
    API: { Events: { endpoint: `https://${REALTIME_HTTP_DOMAIN}/event`, region: "ap-northeast-1", defaultAuthMode: "userPool" } },
  } : {}),
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
