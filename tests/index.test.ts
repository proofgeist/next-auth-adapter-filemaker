import { runBasicTests } from "../adapter-test";
import { FilemakerAdapter } from "../src";

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
    // auth: { apiKey: process.env.OTTO_API_KEY },
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
  });

  runBasicTests({
    adapter: fmAdapter.Adapter,
    db: {
      async account({ provider, providerAccountId }) {},
      async session(sessionToken) {},
      async user(userId) {},
      async verificationToken({ identifier, token }) {},
    },
  });
}
