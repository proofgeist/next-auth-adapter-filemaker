import { runBasicTests } from "../adapter-test";
import { FilemakerAdapter } from "../src";
import { Redis } from "@upstash/redis";
import { DataApi } from "@proofgeist/fmdapi";
import type { FMAccountModel, FMUserModel } from "../src";
import { reviveFromJson } from "../src/upstash-methods";

if (
  !process.env.FM_USERNAME ||
  !process.env.FM_PASSWORD ||
  !process.env.FM_DATABASE ||
  !process.env.FM_SERVER ||
  !process.env.UPSTASH_REDIS_URL ||
  !process.env.UPSTASH_REDIS_TOKEN
) {
  test("Skipping FileMakerAdapter Upstash tests, since required environment variables aren't available", () => {
    expect(true).toBe(true);
  });
} else {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  });

  const fmAdapter = FilemakerAdapter({
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
    upstash: { client: redis, options: { baseKeyPrefix: "testApp:" } },
  });

  const client = DataApi({
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
        const data = await redis.get<string>(
          `testApp:user:session:${sessionToken}`
        );
        if (!data) return null;
        return reviveFromJson(data);
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
        const data = await redis.get<string>(
          `testApp:user:token:${identifier}`
        );
        if (!data) return null;
        return reviveFromJson(data);
      },
    },
  });
}
