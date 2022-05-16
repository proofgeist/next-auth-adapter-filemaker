import type { Account as AdapterAccount } from "next-auth";
import type { Adapter, AdapterUser, AdapterSession } from "next-auth/adapters";
import type { Redis as Upstash } from "@upstash/redis";

export interface UpstashRedisAdapterOptions {
  baseKeyPrefix?: string;
  accountKeyPrefix?: string;
  accountByUserIdPrefix?: string;
  emailKeyPrefix?: string;
  sessionKeyPrefix?: string;
  sessionByUserIdKeyPrefix?: string;
  userKeyPrefix?: string;
  verificationTokenKeyPrefix?: string;
}

export const defaultOptions = {
  baseKeyPrefix: "",
  accountKeyPrefix: "user:account:",
  accountByUserIdPrefix: "user:account:by-user-id:",
  emailKeyPrefix: "user:email:",
  sessionKeyPrefix: "user:session:",
  sessionByUserIdKeyPrefix: "user:session:by-user-id:",
  userKeyPrefix: "user:",
  verificationTokenKeyPrefix: "user:token:",
};

const isoDateRE =
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
function isDate(value: any) {
  return value && isoDateRE.test(value) && !isNaN(Date.parse(value));
}

export function reviveFromJson(json: string) {
  return JSON.parse(json, (_, value) =>
    isDate(value) ? new Date(value) : value
  );
}

export function UpstashMethods(
  client: Upstash,
  options: UpstashRedisAdapterOptions = {}
) {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  const { baseKeyPrefix } = mergedOptions;
  const accountKeyPrefix = baseKeyPrefix + mergedOptions.accountKeyPrefix;
  const accountByUserIdPrefix =
    baseKeyPrefix + mergedOptions.accountByUserIdPrefix;
  const emailKeyPrefix = baseKeyPrefix + mergedOptions.emailKeyPrefix;
  const sessionKeyPrefix = baseKeyPrefix + mergedOptions.sessionKeyPrefix;
  const sessionByUserIdKeyPrefix =
    baseKeyPrefix + mergedOptions.sessionByUserIdKeyPrefix;
  const userKeyPrefix = baseKeyPrefix + mergedOptions.userKeyPrefix;
  const verificationTokenKeyPrefix =
    baseKeyPrefix + mergedOptions.verificationTokenKeyPrefix;

  const getTTL = (expires: Date): number => {
    const today = new Date();
    return (expires.getTime() - today.getTime()) / 1000;
  };

  const setObjectAsJson = async (key: string, obj: any) =>
    await client.set(key, JSON.stringify(obj));

  const setAccount = async (id: string, account: AdapterAccount) => {
    const accountKey = accountKeyPrefix + id;
    await setObjectAsJson(accountKey, account);
    await client.set(accountByUserIdPrefix + account.userId, accountKey);
    return account;
  };

  const getAccount = async (id: string) => {
    const data = await client.get<string>(accountKeyPrefix + id);
    if (!data) return null;
    return reviveFromJson(data);
  };

  const setSession = async (id: string, session: AdapterSession) => {
    const sessionKey = sessionKeyPrefix + id;
    await setObjectAsJson(sessionKey, session);
    await client.set(sessionByUserIdKeyPrefix + session.userId, sessionKey);
    return session;
  };

  const getSession = async (id: string) => {
    const data = await client.get<string>(sessionKeyPrefix + id);
    if (!data) return null;
    return reviveFromJson(data);
  };

  const setUser = async (id: string, user: AdapterUser) => {
    await setObjectAsJson(userKeyPrefix + id, user);
    await client.set(`${emailKeyPrefix}${user.email as string}`, id);
    return user;
  };

  const getUser = async (id: string) => {
    const data = await client.get<string>(userKeyPrefix + id);
    if (!data) return null;
    return reviveFromJson(data);
  };

  async function getUserByEmail(email: string) {
    const data = await client.get<string>(emailKeyPrefix + email);
    if (!data) return null;
    return await getUser(data);
  }

  async function getUserByAccount(account: any) {
    const dbAccount = await getAccount(
      `${account.provider}:${account.providerAccountId}`
    );
    if (!dbAccount) return null;
    return await getUser(dbAccount.userId);
  }

  const deleteSession = async (sessionToken: string) => {
    await client.del(sessionKeyPrefix + sessionToken);
  };

  const deleteUser = async (userId: string) => {
    console.log("about to delete user ID:", userId);
    const { data: user } = await getUser(userId);
    console.log("user while delete", { user });
    if (!user) return;
    const sessionByUserIdKey = `${sessionByUserIdKeyPrefix}${userId}`;
    const sessionKey = await client.get<string>(sessionByUserIdKey);
    await client.del(
      `${emailKeyPrefix}${user.email as string}`,
      sessionKey as string,
      sessionByUserIdKey
    );
  };

  const createVerificationToken = async (verificationToken: any) => {
    await setObjectAsJson(
      verificationTokenKeyPrefix + verificationToken.identifier,
      verificationToken
    );
    return verificationToken;
  };
  const useVerificationToken = async (verificationToken: any) => {
    const tokenKey = verificationTokenKeyPrefix + verificationToken.identifier;
    const tokenResponse = await client.get<string>(tokenKey);
    if (!tokenResponse) return null;
    await client.del(tokenKey);
    return reviveFromJson(tokenResponse);
  };

  return {
    setAccount,
    getAccount,
    setSession,
    getSession,
    setUser,
    getUser,
    getUserByEmail,
    getUserByAccount,
    createVerificationToken,
    useVerificationToken,
    deleteSession,
    deleteUser,
  };
}
