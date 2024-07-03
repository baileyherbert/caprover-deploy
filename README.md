# CapRover Deploy

This is a small app that pairs with CapRover to enable proper remote deployments when using app tokens.

Normally, deployments that use app tokens cannot receive build logs, and have no way of knowing if the build was
successful. This app will proxy those deployments and treat them as if they were authenticated with a master password,
while still ensuring all the same protections of an app token.

## Installation

Create a new app from the CapRover dashboard called `deploy` or similar, and set a new environment variable called
`CAPROVER_PASSWORD` to the plain-text master password for CapRover. It is of course recommended to use a secure,
randomly generated password rather than a personal one.

> Don't want to store your password in plain-text? See the bottom of this file for how to protect it.

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

## Using with GitHub Actions

The following example can be placed inside the steps of a GitHub Actions workflow job. Despite authenticating with an
app token, the workflow will receive the build logs and will know whether or not the deployment was successful.

```yml
- name: Install dependencies
  run: npm i -g caprover

- name: Deploy to server
  run: caprover deploy -u deploy.demo.domain.com
    env:
      CAPROVER_ADMIN_DOMAIN_OVERRIDE: deploy
      CAPROVER_PASSWORD: app-name:${{ secrets.CAPROVER_APP_TOKEN }}
      CAPROVER_APP: app-name
      CAPROVER_BRANCH: ${{ github.ref }}
```

## Using it as the root captain domain

By setting the `ALLOW_WEB_APP` environment variable to `true`, the application will proxy the entire captain web app,
rather than only the API. Depending on your situation and how you expose your web server to the public internet, this
may allow you to replace the `captain` subdomain entirely.

## Protecting the master password

If you aren't comfortable storing your CapRover master password in the app's environment variables, you may optionally
obfuscate it. Run the `node` command in your terminal to open a shell, and paste in the following obfuscator function:

```js
const obfs = (password) => {
	const buffer = Buffer.from(password, 'utf8'), key = require('crypto').randomBytes(256);
	for (let i = 0; i < buffer.length; i++) buffer[i] ^= key[i % key.length];
	console.log('obfs:' + Buffer.concat([key, buffer]).toString('base64'));
}
```

Then, call the function with your master password:

```js
obfs('password')
```

This will return an obfuscated version of the password, which will be a long base64-encoded string that looks something
like below. Make sure to remove any surrounding quotes when you copy it.

```
obfs:BNEwCfV9Boh8QAnL+Y5IGMiRv6/YmBW1NtbbtFE640rgPidCNZuxFM2bwrNxsJxUdCXAs/P7ZUUcJeml9...
```

You can then paste this obfuscated password into the `CAPROVER_PASSWORD` environment variable. Though the password is
still easily obtainable with server access, it cannot be accidentally viewed, and is not compromised even if the
environment variables are shown in a screenshot or video.
