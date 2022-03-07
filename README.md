
In order to prevent

## Option 1: JWT
- 👍🏻 FileMaker is the only database you need
- 👎🏻 You cannot revoke a JWT to instantly log out a user. To mitigate this, you could set the exipre time of the JWT to be very short, but would increase the load on your FMS

## Option 2: Upstash Cache
- 👍🏻 Use true database sessions which can be revoked at any time if needed
- 👍🏻 Set the session age to a longer period of time to keep a user logged in
- 👎🏻 Any changes to the user record in FileMaker will not be immediately reflected in the web app unless you update the cache, but this can be done from the FM side via API call to Upstash.

For this option, you must pass Upstash client credentials into the Adapter.

User lookups will first attempt to pull the user data from Upstash. If they fail, a find in FileMaker will be performed and the user found will then be added to the Upstash cache.