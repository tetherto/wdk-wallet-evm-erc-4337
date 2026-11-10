/**
 * Thrown when the wallet configuration is invalid or has missing required fields.
 *
 * It extends {@link ValueError}, so it is also part of the `WdkError` taxonomy.
 */
export class ConfigurationError extends ValueError {
    /**
     * Create a new configuration error.
     *
     * @param {string} message - The error message.
     * @param {ErrorOptions} [options] - The error's options.
     */
    constructor(message: string, options?: ErrorOptions);
}
import { ValueError } from '@tetherto/wdk-wallet';
