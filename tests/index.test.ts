import { runBasicTests } from "../adapter-test";
import { FilemakerAdapter } from "../src";
import type {
  FMAccountModel,
  FMSessionModel,
  FMUserModel,
  FMVerificationTokenModal,
} from "../src";
import fmDAPI from "@proofgeist/fmdapi";

if (
  !process.env.FM_USERNAME ||
  !process.env.FM_PASSWORD ||
  !process.env.FM_DATABASE ||
  !process.env.FM_SERVER
) {
  test("Skipping FileMakerAdapter tests, since required environment variables aren't available", () => {
    expect(true).toBe(true);
  });
} else {
  const fmAdapter = FilemakerAdapter({
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  });

  const client = fmDAPI({
    server: process.env.FM_SERVER,
    db: process.env.FM_DATABASE,
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
  });

  const layoutUser = "nextauth_user";
  const layoutAccount = "nextauth_account";
  const layoutSession = "nextauth_session";
  const layoutVerificationToken = "nextauth_verificationToken";

  runBasicTests({
    adapter: fmAdapter.Adapter,
    db: {
      disconnect: client.disconnect,
      async account(account) {
        const res = await client.find<FMAccountModel>({
          layout: layoutAccount,
          query: {
            providerAccountId: `==${account.providerAccountId}`,
            provider: `==${account.provider}`,
          },
          ignoreEmptyResult: true,
        });
        const data = res.data[0]?.fieldData;
        return data ?? null;
      },
      async session(sessionToken) {
        const res = await client.find<FMSessionModel>({
          layout: layoutSession,
          query: {
            sessionToken,
          },
          ignoreEmptyResult: true,
        });
        const data = res.data[0]?.fieldData;
        return data ? { ...data, expires: new Date(data.expires) } : null;
      },
      async user(userId) {
        const res = await client.find<FMUserModel>({
          layout: layoutUser,
          query: {
            id: `==${userId}`,
          },
          ignoreEmptyResult: true,
        });
        const data = res.data[0]?.fieldData;
        return data
          ? { ...data, emailVerified: new Date(data.emailVerified) }
          : null;
      },
      async verificationToken({ identifier, token }) {
        const res = await client.find<FMVerificationTokenModal>({
          layout: layoutVerificationToken,
          query: { identifier: `==${identifier}`, token: `==${token}` },
          ignoreEmptyResult: true,
        });
        const data = res.data[0]?.fieldData;
        return data ? { ...data, expires: new Date(data.expires) } : null;
      },
    },
  });
}
