import upstashRedisClient from "@upstash/redis";
import { Upstash } from "@upstash/redis/src/types";
import type { Account as AdapterAccount, User } from "next-auth";
import type { Adapter, AdapterUser, AdapterSession } from "next-auth/adapters";

import { v4 as uuid } from "uuid";
import fmDAPI from "./client";
import { Numerish } from "./client-types";
import { UpstashMethods, UpstashRedisAdapterOptions } from "./upstash-methods";

type DAPIAuth = {
  username: string;
  password: string;
};
type OttoAPIKey = {
  apiKey: string;
  ottoPort?: number;
};
export interface FilemakerAdapterOptions {
  server: string;
  db: string;
  auth: OttoAPIKey;
  upstash?: {
    client: Upstash;
    options?: UpstashRedisAdapterOptions;
  };
}

type FMUserModel = {
  id: string;
  name: string;
  image: string;
  email: string;
  emailVerified: string;
};

type FMAccountModel = {
  id: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string;
  access_token: string;
  expires_at: Numerish;
  token_type: string;
  scope: string;
  id_token: string;
  userId: string;
  oauth_token_secret: string;
  oath_token: string;
  session_state: string;
};

type FMSessionModel = {
  id: string;
  sessionToken: string;
  expires: string;
  userId: string;
};

type FMVerificationTokenModal = {
  token: string;
  expires: string;
  identifier: string;
};

type AdapterReturn = {
  Adapter: Adapter;
  updateUserCache: (user: User) => Promise<void>;
};

export function FilemakerAdapter(
  options: FilemakerAdapterOptions
): AdapterReturn {
  const client = fmDAPI({
    server: options.server,
    db: options.db,
    apiKey: options.auth.apiKey,
  });

  const redisEnabled = Boolean(options.upstash);
  const upstash = UpstashMethods(
    options.upstash.client,
    options.upstash.options
  );

  const layoutUser = "nextauth_user";
  const layoutAccount = "nextauth_account";
  const layoutSession = "nextauth_session";
  const layoutVerificationToken = "nextauth_verificationToken";

  async function getUserRecordId(userId: string): Promise<number> {
    const foundUser = await client.find<FMUserModel>(
      layoutUser,
      {
        id: `==${userId}`,
      },
      undefined,
      false // throw error if not found
    );
    return parseInt(foundUser.data[0].recordId);
  }

  async function getAccount(
    account: Pick<AdapterAccount, "provider" | "providerAccountId">
  ) {
    const res = await client.find<FMAccountModel, { user: FMUserModel }>(
      layoutAccount,
      {
        providerAccountId: `==${account.providerAccountId}`,
        provider: `==${account.provider}`,
      },
      {},
      true
    );
    if (res.data.length === 0) return null;
    return res.data[0];
  }

  async function getUser(id: string): Promise<FMUserModel> {
    const res = await client.find<FMUserModel>(
      layoutUser,
      {
        id: `==${id}`,
      },
      {},
      true
    );
    if (res.data.length === 0) return null;
    const data = res.data[0].fieldData;
    return data;
  }

  const reviveFmUser = (user: FMUserModel) => {
    return {
      ...user,
      emailVerified:
        user.emailVerified !== "" ? new Date(user.emailVerified) : null,
    };
  };

  const cacheFmUser = async (user: FMUserModel) => {
    const data = reviveFmUser(user);
    if (redisEnabled) await upstash.setUser(data.id, data);
    return data;
  };

  const updateUserCache = async (user: User) => {
    if (!redisEnabled) return;
    const data = await getUser(user.id);
    if (data) await cacheFmUser(data);
  };

  const Adapter: Adapter = {
    async createUser(user) {
      console.log("createUser running...");
      const res = await client.create<FMUserModel>(layoutUser, {
        ...user,
        emailVerified: user.emailVerified?.toString() ?? "",
      });
      const record = await client.get<FMUserModel>(
        layoutUser,
        parseInt(res.recordId)
      );
      const data = record.data[0].fieldData;
      return await cacheFmUser(data);
    },
    async getUser(id) {
      console.log("getUser running...");

      if (redisEnabled) {
        // first try to get user from Upstash
        const user = await upstash.getUser(id);
        if (user) return user;
      }

      // else, fetch from FM
      const data = await getUser(id);

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async getUserByEmail(email) {
      console.log("getUserByEmail running...");

      if (redisEnabled) {
        // first try to get user from Upstash
        const user = await upstash.getUserByEmail(email);
        if (user) return user;
      }

      // else, fetch from FM
      const res = await client.find<FMUserModel>(
        layoutUser,
        {
          email: `==${email}`,
        },
        {},
        true
      );
      if (res.data.length === 0) return null;
      const data = res.data[0].fieldData;

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async getUserByAccount(account) {
      console.log("getUserByAccount running...");

      if (redisEnabled) {
        // first try to get user from Upstash
        const user = await upstash.getUserByAccount(account);
        if (user) return user;
      }

      // else, fetch from FM
      const foundAccount = await getAccount(account);
      if (!foundAccount) return null;
      const userID = foundAccount.fieldData.userId;
      const userRecord = await client.find<FMUserModel>(
        layoutUser,
        {
          id: `==${userID}`,
        },
        null,
        true
      );
      if (userRecord.data.length !== 1) return null;
      const data = userRecord.data[0].fieldData;

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async updateUser(user) {
      console.log("updateUser running...");
      const recordId = await getUserRecordId(user.id ?? "");
      await client.update<FMUserModel>(layoutUser, recordId, {
        email: user.email ?? "",
        name: user.name ?? "",
        emailVerified: user.emailVerified?.toString() ?? "",
      });
      const res = await client.get<FMUserModel>(layoutUser, recordId);
      const data = res.data[0].fieldData;
      return await cacheFmUser(data);
    },
    async deleteUser(userId) {
      console.log("deleteUser running...");
      const recordId = await getUserRecordId(userId);
      await client.delete(layoutUser, recordId);
      // TODO delete cache from redis also
    },
    async linkAccount(account) {
      console.log("linkAccount running...");
      await client.create<FMAccountModel>(layoutAccount, account);
      return;
    },
    async unlinkAccount(account) {
      console.log("unlinkAccount running...");
      // delete account record?
      const foundAccount = await getAccount(account);
      if (!foundAccount) return;
      await client.delete(layoutAccount, parseInt(foundAccount.recordId));
      return;
    },
    async createSession(session) {
      console.log("createSession running...");
      const { sessionToken, userId, expires } = session;

      return await upstash.setSession(sessionToken, {
        ...session,
        id: sessionToken,
      });

      const res = await client.create<FMSessionModel>(layoutSession, {
        sessionToken,
        userId,
        expires: expires.toISOString(),
      });
      const sessionRecord = await client.get<FMSessionModel>(
        layoutSession,
        parseInt(res.recordId)
      );
      const data = sessionRecord.data[0].fieldData;
      return { ...data, expires: new Date(data.expires) };
    },
    async getSessionAndUser(sessionToken) {
      console.log("getSessionAndUser running...");

      const session = await upstash.getSession(sessionToken);
      if (!session) return null;
      const user = await upstash.getUser(session.userId);
      if (!user) return null;
      return { session, user };

      const record = await client.find<FMSessionModel>(
        layoutSession,
        {
          sessionToken,
        },
        null,
        true
      );
      if (record.data.length !== 1) return null;
      const sessionRecord = record.data[0].fieldData;
      const userID = sessionRecord.userId;
      const userRecord = await client.find<FMUserModel>(
        layoutUser,
        {
          id: `==${userID}`,
        },
        null,
        true
      );
      if (userRecord.data.length !== 1) return null;
      const data = userRecord.data[0].fieldData;
      const userData = await cacheFmUser(data);
      return {
        session: { ...session, expires: new Date(session.expires) },
        user: userData,
      };
    },
    async updateSession(updates) {
      console.log("updateSession running...");

      const session = await upstash.getSession(updates.sessionToken);
      if (!session) return null;
      return await upstash.setSession(updates.sessionToken, {
        ...session,
        ...updates,
      });

      const record = await client.find<FMSessionModel>(
        layoutSession,
        {
          sessionToken: session.sessionToken,
        },
        null,
        true
      );
      if (record.data.length !== 1) return null;
      const recID = parseInt(record.data[0].recordId);
      await client.update<FMSessionModel>(layoutSession, recID, {
        ...updates,
        expires: updates.expires.toISOString(),
      });
      return;
    },
    async deleteSession(sessionToken) {
      console.log("deleteSession running...");
      if (redisEnabled) return await upstash.deleteSession(sessionToken);
      const record = await client.find<FMSessionModel>(
        layoutSession,
        {
          sessionToken,
        },
        null,
        true
      );
      if (record.data.length !== 1) return null;
      const recID = parseInt(record.data[0].recordId);
      await client.delete<FMSessionModel>(layoutSession, recID);
      return;
    },
    async createVerificationToken({ identifier, expires, token }) {
      console.log("createVerificationToken running...");

      if (redisEnabled)
        return await upstash.createVerificationToken({
          identifier,
          expires,
          token,
        });

      await client.create<FMVerificationTokenModal>(layoutVerificationToken, {
        identifier,
        token,
        expires: expires.toISOString(),
      });
      return { expires, identifier, token };
    },
    async useVerificationToken({ identifier, token }) {
      console.log("useVerificationToken running...");

      if (redisEnabled)
        return await upstash.useVerificationToken({ identifier, token });

      const record = await client.find<FMVerificationTokenModal>(
        layoutVerificationToken,
        { identifier: `==${identifier}`, token: `==${token}` }
      );
      if (record.data.length !== 1) return null;
      await client.delete<FMVerificationTokenModal>(
        layoutVerificationToken,
        parseInt(record.data[0].recordId)
      );
      const data = record.data[0].fieldData;
      return { ...data, expires: new Date(data.expires) };
    },
  };
  return { Adapter, updateUserCache };
}
