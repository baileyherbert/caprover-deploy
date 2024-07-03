import { Env } from '@baileyherbert/env';
import { LogLevel } from '@baileyherbert/logging';

export const Environment = Env.rules({
	PORT: Env.schema.number().optional(80),
	LOGGING_LEVEL: Env.schema.enum(LogLevel).optional(LogLevel.Information).allowPartial(),
	CAPROVER_PASSWORD: Env.schema.string(),
	CAPROVER_URL: Env.schema.string().optional('http://captain-captain:3000'),
	ALLOW_WEB_APP: Env.schema.boolean().optional(false),
	TRUSTED_PROXY: (value?: string) => {
		if (typeof value === 'string' && value.length > 0) {
			value = value.trim().toLowerCase();

			if (value === 'true') return true;
			if (value === 'false') return false;
			if (value.match(/^\d+$/)) return Number(value);
			if (value.length === 0) return;

			return value;
		}

		return '10.0.1.0/24';
	},
});
