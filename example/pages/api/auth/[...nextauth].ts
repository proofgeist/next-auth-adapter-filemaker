import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import upstashRedisClient from "@upstash/redis";
import { FilemakerAdapter } from "../../../../dist";
import { createClient } from "redis";

const upstash = upstashRedisClient(
  process.env.UPSTASH_REDIS_URL,
  process.env.UPSTASH_REDIS_TOKEN
);

const redisClient = createClient({
  socket: {
    host: "usw1-cunning-husky-32825.upstash.io",
    port: 32825,
  },
  password: "eac97fb3715c4faca9873499e37c7ac4",
});

const fmAdapter = FilemakerAdapter({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
  // upstash: { client: upstash, options: { baseKeyPrefix: "demo:" } },
  redis: { client: redisClient },
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
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
});
