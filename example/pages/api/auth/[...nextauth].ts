import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import upstashRedisClient from "@upstash/redis";
import { FilemakerAdapter } from "../../../../dist";

const redis = upstashRedisClient(
  process.env.UPSTASH_REDIS_URL,
  process.env.UPSTASH_REDIS_TOKEN
);

const fmAdapter = FilemakerAdapter({
  auth: { apiKey: process.env.OTTO_API_KEY },
  // auth: {
  //   username: process.env.FM_USERNAME,
  //   password: process.env.FM_PASSWORD,
  // },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
  upstash: { client: redis, options: { baseKeyPrefix: "demo:" } },
});

export default NextAuth({
  adapter: fmAdapter.Adapter,
  callbacks: {
    async signIn(params) {
      const { user, email } = params;
      if (email?.verificationRequest) return true;

      // update user cache on login
      // this may run before the "createUser" method, but that method also updates the user cache
      await fmAdapter.updateUserCache(user);
      return true;
    },
    session(params) {
      const session = { ...params.session, user: params.user };
      return session;
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
});
