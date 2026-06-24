import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-northeast-1_QG4KZb06z",
      userPoolClientId: "280tvccus7fe6kc6uhvsjs9n4g",
    },
  },
});
