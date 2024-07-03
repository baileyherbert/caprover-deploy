# CapRover Deploy

This is a small app that pairs with CapRover to enable proper remote deployments when using app tokens.

Normally, deployments that use app tokens cannot receive build logs, and have no way of knowing if the build was
successful. This app will proxy those deployments and treat them as if they were authenticated with a master password,
while still ensuring all the same protections of an app token.

## Installation

Create a new app from the CapRover dashboard called `deploy` or similar, and set a new environment variable called
`CAPROVER_PASSWORD` to the plain-text master password for CapRover. It is of course recommended to use a secure,
randomly generated password rather than a personal one.

Now deploy the `baileyherbert/caprover-deploy:latest` image from the deployment tab, and wait for the success message to
appear in the app logs. The app is now up and running, and ready to proxy your deployments. No other configuration is
necessary.

## Using with the CapRover CLI

From now on, when you deploy using the CapRover CLI, you will need to use the app's hostname that was automatically
assigned by CapRover. In the example above, the hostname might be `deploy.demo.example.com`.

Instead of sending your app token with the `--appToken` flag, you will instead use the `--caproverPassword` or `-p`
flag to provide both the app name and the token, delimited by a colon, like shown below. You will still need to provide
the app name in the `-a` flag as well.

```
-a APP_NAME -p APP_NAME:APP_TOKEN
```

Unfortunately, the CapRover CLI will automatically prepend "captain" to the beginning of our hostname if it isn't
already present, so we must set the `CAPROVER_ADMIN_DOMAIN_OVERRIDE` environment variable to the name of our app to
change the expected subdomain.

This is what the full deployment script would look like:

```sh
export CAPROVER_ADMIN_DOMAIN_OVERRIDE=deploy
caprover deploy -u deploy.demo.domain.com -a $APP_NAME -p $APP_NAME:$TOKEN
```
