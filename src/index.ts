import type { Account as AdapterAccount, User } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { Redis as Upstash } from "@upstash/redis";

import { DataApi } from "@proofgeist/fmdapi";
type DapiApiProps = Parameters<typeof DataApi>[0];

import {
  UpstashMethods,
  UpstashRedisAdapterOptions,
} from "./upstash-methods.js";

export interface FilemakerAdapterOptions<A extends DapiApiProps["adapter"]> {
  adapter: A;
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
type FMUserModelWithPasswordHash = FMUserModel & { passwordHash: string };

type FMAccountModel = {
  id: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string;
  access_token: string;
  expires_at: string | number;
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

type AdapterReturn<A extends DapiApiProps["adapter"]> = {
  Adapter: Adapter;
  updateUserCache: (user: User) => Promise<void>;
  typedClients: {
    user: ReturnType<typeof DataApi<any, FMUserModel, any, A>>;
    userWithPasswordHash: ReturnType<
      typeof DataApi<any, FMUserModelWithPasswordHash, any, A>
    >;
    account: ReturnType<typeof DataApi<any, FMAccountModel, any, A>>;
    session: ReturnType<typeof DataApi<any, FMSessionModel, any, A>>;
    verificationToken: ReturnType<
      typeof DataApi<any, FMVerificationTokenModal, any, A>
    >;
  };
};

export type {
  FMAccountModel,
  FMSessionModel,
  FMUserModel,
  FMVerificationTokenModal,
};

export function FilemakerAdapter<A extends DapiApiProps["adapter"]>(
  options: FilemakerAdapterOptions<A>
): AdapterReturn<A> {
  const client = DataApi({
    adapter: options.adapter,
  });

  const upstash =
    options.upstash &&
    UpstashMethods(options.upstash.client, options.upstash.options);

  const layoutUser = "nextauth_user";
  const layoutAccount = "nextauth_account";
  const layoutSession = "nextauth_session";
  const layoutVerificationToken = "nextauth_verificationToken";

  async function getUserRecordId(userId: string): Promise<number> {
    const foundUser = await client.find<FMUserModel>({
      layout: layoutUser,
      query: {
        id: `==${userId}`,
      },
    });
    return parseInt(foundUser.data[0].recordId);
  }

  async function getAccount(
    account: Pick<AdapterAccount, "provider" | "providerAccountId">
  ) {
    const res = await client.find<FMAccountModel, { user: FMUserModel }>({
      layout: layoutAccount,
      query: {
        providerAccountId: `==${account.providerAccountId}`,
        provider: `==${account.provider}`,
      },
      ignoreEmptyResult: true,
    });
    if (res.data.length === 0) return undefined;
    return res.data[0];
  }

  async function getUser(id: string): Promise<FMUserModel | null> {
    const res = await client.find<FMUserModel>({
      layout: layoutUser,
      query: {
        id: `==${id}`,
      },
      ignoreEmptyResult: true,
    });
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

  const cacheFmUser = async (user: FMUserModel): Promise<AdapterUser> => {
    const data = reviveFmUser(user);
    if (upstash) await upstash.setUser(data.id, data);
    return data;
  };

  const updateUserCache = async (user: User) => {
    if (!upstash) return;
    if (!user.id) return;
    const data = await getUser(user.id);
    if (data) await cacheFmUser(data);
  };

  const Adapter: Adapter = {
    async createUser(user: any) {
      console.log("createUser running...");
      const res = await client.create<FMUserModel>({
        layout: layoutUser,
        fieldData: {
          ...user,
          emailVerified: user.emailVerified?.toISOString() ?? "",
        },
      });
      const record = await client.get<FMUserModel>({
        layout: layoutUser,
        recordId: parseInt(res.recordId),
      });
      const data = record.data[0].fieldData;
      return await cacheFmUser(data);
    },
    async getUser(id) {
      console.log("getUser running...");

      if (upstash) {
        // first try to get user from Upstash
        const user = await upstash.getUser(id);
        if (user) return user;
      }

      // else, fetch from FM
      const data = await getUser(id);
      if (!data) return null;

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async getUserByEmail(email) {
      console.log("getUserByEmail running...");

      if (upstash) {
        // first try to get user from Upstash
        const user = await upstash.getUserByEmail(email);
        if (user) return user;
      }

      // else, fetch from FM
      const res = await client.find<FMUserModel>({
        layout: layoutUser,
        query: {
          email: `==${email}`,
        },
        ignoreEmptyResult: true,
      });
      if (res.data.length === 0) return null;
      const data = res.data[0].fieldData;

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async getUserByAccount(account) {
      console.log("getUserByAccount running...");

      if (upstash) {
        // first try to get user from Upstash
        const user = await upstash.getUserByAccount(account);
        if (user) return user;
      }

      // else, fetch from FM
      const foundAccount = await getAccount(account);
      if (!foundAccount) return null;
      const userID = foundAccount.fieldData.userId;
      const userRecord = await client.find<FMUserModel>({
        layout: layoutUser,
        query: { id: `==${userID}` },
        ignoreEmptyResult: true,
      });

      if (userRecord.data.length !== 1) return null;
      const data = userRecord.data[0].fieldData;

      // then update upstash cache
      return await cacheFmUser(data);
    },
    async updateUser(user) {
      console.log("updateUser running...");
      const recordId = await getUserRecordId(user.id ?? "");

      let patchData: any = user;
      if (patchData.emailVerified)
        // must convert to string if it exists
        patchData.emailVerified = patchData.emailVerified.toISOString();

      // cannot modify the id in FM
      delete patchData.id;

      await client.update<FMUserModel>({
        layout: layoutUser,
        recordId,
        fieldData: patchData,
      });
      const res = await client.get<FMUserModel>({
        layout: layoutUser,
        recordId,
      });
      const data = res.data[0].fieldData;
      return await cacheFmUser(data);
    },
    async deleteUser(userId) {
      console.log("deleteUser running...");
      const recordId = await getUserRecordId(userId);
      await client.delete({ layout: layoutUser, recordId });

      if (upstash) {
        await upstash.deleteUser(userId);
      }
    },
    async linkAccount(account) {
      console.log("linkAccount running...");
      await client.create<FMAccountModel>({
        layout: layoutAccount,
        fieldData: account,
      });
      return;
    },
    async unlinkAccount(account) {
      console.log("unlinkAccount running...");
      // delete account record?
      const foundAccount = await getAccount(account);
      if (!foundAccount) return;
      await client.delete({
        layout: layoutAccount,
        recordId: parseInt(foundAccount.recordId),
      });
      return;
    },
    async createSession(session) {
      console.log("createSession running...");
      const { sessionToken, userId, expires } = session;

      if (upstash)
        return await upstash.setSession(sessionToken, {
          ...session,
          id: sessionToken,
        });

      const res = await client.create<FMSessionModel>({
        layout: layoutSession,
        fieldData: {
          sessionToken,
          userId,
          expires: expires.toISOString(),
        },
      });
      const sessionRecord = await client.get<FMSessionModel>({
        layout: layoutSession,
        recordId: parseInt(res.recordId),
      });
      const data = sessionRecord.data[0].fieldData;
      return { ...data, expires: new Date(data.expires) };
    },
    async getSessionAndUser(sessionToken) {
      console.log("getSessionAndUser running...");

      if (upstash) {
        const session = await upstash.getSession(sessionToken);
        if (!session) return null;
        const user = await upstash.getUser(session.userId);
        if (!user) return null;
        return { session, user };
      }

      const record = await client.find<FMSessionModel>({
        layout: layoutSession,
        query: {
          sessionToken,
        },
        ignoreEmptyResult: true,
      });
      if (record.data.length !== 1) return null;
      const sessionRecord = record.data[0].fieldData;
      const userID = sessionRecord.userId;
      const userRecord = await client.find<FMUserModel>({
        layout: layoutUser,
        query: {
          id: `==${userID}`,
        },
        ignoreEmptyResult: true,
      });
      if (userRecord.data.length !== 1) return null;
      const data = userRecord.data[0].fieldData;
      const userData = await cacheFmUser(data);
      return {
        session: { ...sessionRecord, expires: new Date(sessionRecord.expires) },
        user: userData,
      };
    },
    async updateSession(updates) {
      console.log("updateSession running...");

      if (upstash) {
        const session = await upstash.getSession(updates.sessionToken);
        if (!session) return null;
        return await upstash.setSession(updates.sessionToken, {
          ...session,
          ...updates,
        });
      }

      const record = await client.find<FMSessionModel>({
        layout: layoutSession,
        query: {
          sessionToken: updates.sessionToken,
        },
        ignoreEmptyResult: true,
      });
      if (record.data.length !== 1) return null;
      const recordId = parseInt(record.data[0].recordId);

      const updateData = updates as any;
      await client.update({
        layout: layoutSession,
        recordId,
        fieldData: updateData,
      });
      return;
    },
    async deleteSession(sessionToken) {
      console.log("deleteSession running...");
      if (upstash) return await upstash.deleteSession(sessionToken);
      const record = await client.find<FMSessionModel>({
        layout: layoutSession,
        query: {
          sessionToken: `==${sessionToken}`,
        },
        ignoreEmptyResult: true,
      });
      if (record.data.length !== 1) return;
      const recordId = parseInt(record.data[0].recordId);
      await client.delete({ layout: layoutSession, recordId });
      return;
    },
    async createVerificationToken({ identifier, expires, token }) {
      console.log("createVerificationToken running...");

      if (upstash)
        return await upstash.createVerificationToken({
          identifier,
          expires,
          token,
        });

      await client.create<FMVerificationTokenModal>({
        layout: layoutVerificationToken,
        fieldData: {
          identifier,
          token,
          expires: expires.toISOString(),
        },
      });
      return { expires, identifier, token };
    },
    async useVerificationToken({ identifier, token }) {
      console.log("useVerificationToken running...");

      if (upstash)
        return await upstash.useVerificationToken({ identifier, token });

      const record = await client.find<FMVerificationTokenModal>({
        layout: layoutVerificationToken,
        query: { identifier: `==${identifier}`, token: `==${token}` },
        ignoreEmptyResult: true,
      });
      if (record.data.length !== 1) return null;
      await client.delete({
        layout: layoutVerificationToken,
        recordId: parseInt(record.data[0].recordId),
      });
      const data = record.data[0].fieldData;
      return { ...data, expires: new Date(data.expires) };
    },
  };
  return {
    Adapter,
    updateUserCache,
    typedClients: {
      user: DataApi<any, FMUserModel, any, A>({
        adapter: options.adapter,
        layout: layoutUser,
      }),
      userWithPasswordHash: DataApi<any, FMUserModelWithPasswordHash, any, A>({
        adapter: options.adapter,
        layout: `${layoutUser}_password`,
      }),
      account: DataApi<any, FMAccountModel, any, A>({
        adapter: options.adapter,
        layout: layoutAccount,
      }),
      session: DataApi<any, FMSessionModel, any, A>({
        adapter: options.adapter,
        layout: layoutSession,
      }),
      verificationToken: DataApi<any, FMVerificationTokenModal, any, A>({
        adapter: options.adapter,
        layout: layoutVerificationToken,
      }),
    },
  };
}
