import { Logger } from '@baileyherbert/logging';
import { Environment } from './environment.js';

export const logger = new Logger();
logger.createConsoleTransport(Environment.LOGGING_LEVEL);
