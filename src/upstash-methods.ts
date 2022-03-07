import type { Account as AdapterAccount } from "next-auth";
import type { Adapter, AdapterUser, AdapterSession } from "next-auth/adapters";
import { Upstash } from "@upstash/redis/src/types";

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
    const response = await client.get(accountKeyPrefix + id);
    if (!response.data) return null;
    return reviveFromJson(response.data);
  };

  const setSession = async (id: string, session: AdapterSession) => {
    const sessionKey = sessionKeyPrefix + id;
    await setObjectAsJson(sessionKey, session);
    await client.set(sessionByUserIdKeyPrefix + session.userId, sessionKey);
    return session;
  };

  const getSession = async (id: string) => {
    const response = await client.get(sessionKeyPrefix + id);
    if (!response.data) return null;
    return reviveFromJson(response.data);
  };

  const setUser = async (id: string, user: AdapterUser) => {
    await setObjectAsJson(userKeyPrefix + id, user);
    await client.set(`${emailKeyPrefix}${user.email as string}`, id);
    return user;
  };

  const getUser = async (id: string) => {
    const response = await client.get(userKeyPrefix + id);
    if (!response.data) return null;
    return reviveFromJson(response.data);
  };

  async function getUserByEmail(email: string) {
    const emailResponse = await client.get(emailKeyPrefix + email);
    if (!emailResponse.data) return null;
    return await getUser(emailResponse.data);
  }

  async function getUserByAccount(account) {
    const dbAccount = await getAccount(
      `${account.provider}:${account.providerAccountId}`
    );
    if (!dbAccount) return null;
    return await getUser(dbAccount.userId);
  }

  const deleteSession = async (sessionToken: string) => {
    await client.del(sessionKeyPrefix + sessionToken);
  };

  const createVerificationToken = async (verificationToken) => {
    await setObjectAsJson(
      verificationTokenKeyPrefix + verificationToken.identifier,
      verificationToken
    );
    return verificationToken;
  };
  const useVerificationToken = async (verificationToken) => {
    const tokenKey = verificationTokenKeyPrefix + verificationToken.identifier;
    const tokenResponse = await client.get(tokenKey);
    if (!tokenResponse.data) return null;
    await client.del(tokenKey);
    return reviveFromJson(tokenResponse.data);
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
  };
}
