
<p align="center">
   <br/>
   <a href="https://next-auth.js.org" target="_blank"><img height="64px" src="https://next-auth.js.org/img/logo/logo-sm.png" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<img height="64px" src="logo.png" />
   <h3 align="center"><b>FileMaker Server Adapter</b> - NextAuth.js</h3>
   <p align="center">
   Open Source. Full Stack. Own Your Data.
   </p>
</p>

## Overview 
This is the FileMaker Server adapter for [`next-auth`](https://next-auth.js.org). This package can only be used in conjunction with the primary `next-auth`. It is not a standalone package. It uses the FileMaker Data API interally, but no specific FM Data API client is required.

:warning: This is a BETA package with limited functionality. Current limitations:
- Requries [Otto](https://ottofms.com/)'s [Data API Proxy](https://www.ottofms.com/docs/developer-api/proxy)
- Caching with Redis (optional) only works with the [Upstash](https://upstash.com/) service

## Getting Started
1. Install via npm
```
npm install next-auth next-auth-adapter-filemaker
```
2. Add `nextauth` schema to your FileMaker file

:warning: FileMaker Add-On coming soon! In the meantime, you must add the following 4 tables to your FileMaker database. The schema can be copied from the [FileMaker file](/NextAuth.fmp12) in this repo. Username: `admin`; Password: `admin`
- nextauth_user
- nextauth_account
- nextauth_session 
- nextauth_verificationToken

You must also have 1 layout for each of these tables in your file, with the **exact** same name as the table.

Lastly, make sure you have a user account in the FileMaker file with `fmrest` privileges and generate an API key for use with Otto's [Data API Proxy](https://www.ottofms.com/docs/developer-api/proxy).

3. Add the follwing code to your `pages/api/[...nextauth].js` next-auth configuration object.

```ts
import NextAuth from "next-auth";
import { FilemakerAdapter } from "next-auth-adapter-filemaker";

const fmAdapter = FilemakerAdapter({
  auth: { apiKey: "OTTO_API_KEY" },
  db: "FM_DATABASE",
  server: "https://myfmserver.com",
});

export default NextAuth({
    ...
    adapter: fmAdapter.Adapter,
    ...
});

```

## Optimizations
With the default behavior of next-auth when you use an adapter, the web app will check the user's session at least as frequently as on each page load, sometimes more frequently. If you'd like to optimize this for speed or limit the use of the Data API, you have a couple of options, but each come with a set of their own trade-off that you should understand.

### Option 1: JWT
- 👍🏻 Super simple to configure
- 👍🏻 FileMaker is the only database you need
- 👎🏻 You cannot revoke a JWT to instantly log out a user. To mitigate this, you could set the exipre time of the JWT to be very short, but would increase the load on your FMS

To enable JWT within next-auth, see the session strategry to `jwt` in your [configuration](https://next-auth.js.org/configuration/options#session). You may also want to adjust the `maxAge` of your JWT to fine-tune how frequently the JWT will expire.

NOTE: With this option, the Session table will not be used in your FileMaker file.
### Option 2: Redis Cache
- 👍🏻 Use true database sessions which can be revoked at any time if needed
- 👍🏻 Drastically limits Data API calls to your FileMaker Server
- 👎🏻 Any changes to the user record in FileMaker will not be immediately reflected in the web app unless you update the cache, but this can be done from the FM side via API call to Upstash.

:warning: This feature is currently only supported with the [Upstash](https://upstash.com/) redis host.
```
npm install @upstash/redis
```

To use, pass Upstash client credentials into the Adapter.
```ts
import upstashRedisClient from "@upstash/redis"

const redis = upstashRedisClient(
    "UPSTASH_REDIS_URL",
    "UPSTASH_REDIS_TOKEN"
);

const fmAdapter = FilemakerAdapter({
    ...
    upstash: { client: redis },
});
```

User and Session lookups will first attempt to pull the user data from the redis cache. If they fail, a find in FileMaker will be performed and the user found will then be added to the Upstash cache. If you want to update a user's information mid-session, you must update the cache. This can be done by calling a FileMaker script to interact with the Upstash HTTP API, or with JavaScript inside of the [signIn callback](https://next-auth.js.org/configuration/callbacks#sign-in-callback):

```ts
 callbacks: {
    async signIn({user}) {
      await fmAdapter.updateUserCache(user);
      return true;
    },
  },
```

NOTE: When this option is enabled, the Session and Verification Token tables will not be used in your FileMaker file, as the data is stored in Redis instead.