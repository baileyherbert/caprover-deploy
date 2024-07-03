import 'source-map-support/register.js';
import { logger } from './logger.js';
import { Environment } from './environment.js';
import express, { Request } from 'express';
import httpProxy from 'express-http-proxy';
import bodyParser from 'body-parser';
import crypto from 'crypto';

const app = express();
const proxy = httpProxy(Environment.CAPROVER_URL);
const proxyForMultipart = httpProxy(Environment.CAPROVER_URL, {
	reqAsBuffer: true,
	reqBodyEncoding: null,
	parseReqBody: false
});
const tokens = new Map<string, TokenData>();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function isMultipartRequest(req: Request) {
	const contentTypeHeader = req.headers['content-type']
	return contentTypeHeader && contentTypeHeader.indexOf('multipart') > -1;
}

async function login(): Promise<string> {
	const url = new URL('/api/v2/login', Environment.CAPROVER_URL);

	logger.debug('Logging into caprover with master password...');
	logger.trace('Login URL:', url.toString());

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			password: Environment.CAPROVER_PASSWORD,
		}),
	});

	logger.trace('Received HTTP status code:', response.status);

	if (!response.ok) {
		logger.error('Failed to log into CapRover due to a server error');
		logger.debug('Raw response:', await response.text());

		throw new Error('Failed to log into CapRover with the configured master password');
	}

	const data = await response.json();

	if (data.status !== 100) {
		logger.error('Received unexpected status code from CapRover:', data.status);
		throw new Error('Failed to log into CapRover with the configured master password');
	}

	return data.data.token;
}

async function getAppAuthorized(appName: string, appToken: string) {
	logger.info('Authenticating token for app: %s...', appName);

	const url = new URL(`/api/v2/user/apps/appData/${appName}?detached=1`, Environment.CAPROVER_URL);
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-captain-app-token': appToken,
		}
	});

	if (!response.ok) {
		logger.error('Failed to authenticate app token for app:', appName);
		logger.debug('Raw response:', await response.text());
		return false;
	}

	const content = await response.json();

	if (content.status === 1108) {
		logger.info('Successfully authenticated app token for app:', appName);
		return true;
	}

	if (content.status === 1106) {
		logger.warning('Received an incorrect app token for app:', appName);
		return false;
	}

	logger.error('Received an unexpected status code:', content.status);
	logger.debug('Raw response:', content);
	return false;
}

function createToken(appName: string, masterToken: string): TokenData {
	const payload = crypto.randomBytes(64).toString('hex');
	const hash = crypto.createHash('sha256').update(appName + payload).digest('hex').substring(0, 24);
	const token = hash + payload;

	const result: TokenData = {
		token,
		masterToken,
		createTimestamp: Date.now(),
		appName
	};

	tokens.set(token, result);
	return result;
}

function createAppDefinitionResponse(appName: string) {
	return {
		status: 100,
		description: 'App definitions are retrieved.',
		data: {
			appDefinitions: [
				{
					appName,
				}
			],
			rootDomain: '',
			captainSubDomain: 'captain'
		}
	}
}

app.set('trust proxy', Environment.TRUSTED_PROXY);
app.use('/', async (req, res, next) => {
	if (!Environment.ALLOW_WEB_APP && !req.path.startsWith('/api/v2')) {
		return res.status(404).send();
	}

	logger.info('%s %s from %s', req.method, req.url, req.ip);

	if (req.method === 'POST' && req.path === '/api/v2/login') {
		const input = req.body.password as string;

		if (input && input.includes(':')) {
			const [appName, appToken] = input.split(':');

			if (appName.includes('/') || appName.includes('\\')) {
				return res.status(200).json({
					status: 0,
					description: 'Invalid app name format'
				});
			}

			if (appToken !== Environment.CAPROVER_PASSWORD) {
				const masterToken = await login();

				if (!await getAppAuthorized(appName, appToken)) {
					return res.status(200).json({
						status: 0,
						description: `The provided app token is invalid or does not have permission to access "${appName}"`,
					});
				}

				const token = createToken(appName, masterToken);
				const response = {
					status: 100,
					data: {
						token: 'd-' + token.token,
					},
				};

				return res.status(200).json(response);
			}
		}
	}

	const authHeader = req.headers['x-captain-auth'];
	if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('d-')) {
		const rawToken = authHeader.substring(2);
		const token = tokens.get(rawToken);

		logger.debug('Received a proxied request for: %s %s', req.method, req.url);

		if (!token) {
			logger.error('Received an invalid or expired token!');

			return res.status(200).json({
				status: 0,
				description: 'Invalid or expired token',
			});
		}

		logger.debug('Token allows access to app: %s', token.appName);

		if (req.method === 'GET' && req.path === '/api/v2/user/apps/appDefinitions') {
			return res.status(200).json(createAppDefinitionResponse(token.appName));
		}

		if (req.path === `/api/v2/user/apps/appData/${token.appName}`) {
			req.headers['x-captain-auth'] = token.masterToken;

			if (isMultipartRequest(req)) {
				logger.trace('Request is multipart, using special proxy settings...');
				return proxyForMultipart(req, res, next);
			}

			return proxy(req, res, next);
		}

		logger.error('Received an unsupported request for %s %s', req.method, req.url);
		return res.status(200).json({
			status: 0,
			description: 'Unsupported request',
		});
	}

	if (isMultipartRequest(req)) {
		logger.trace('Request is multipart, using special proxy settings...');
		return proxyForMultipart(req, res, next);
	}

	return proxy(req, res, next);
});

app.listen(Environment.PORT, () => {
	logger.info('Success! The app is running and ready to proxy your deployments.');
});

setInterval(() => {
	const expiration = Date.now() - 10800000;
	const expired = new Set<string>();

	for (const [key, value] of tokens) {
		if (value.createTimestamp < expiration) {
			expired.add(key);
		}
	}

	for (const key of expired) {
		tokens.delete(key);
	}

	logger.debug('Cleaned up %d expired tokens', expired.size);
}, 10800000).unref();

interface TokenData {
	token: string;
	masterToken: string;
	createTimestamp: number;
	appName: string;
}
