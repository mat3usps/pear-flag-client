import {
    EvaluateFlagRequest,
    EvaluateFlagResponse,
    EvaluateFlagsRequest,
    FeatureFlagClientConfig,
    ValidationProps,
} from "./types";

// TODO: add real url
export const DEFAULT_BASE_URL = "http://localhost:5173";

class FeatureFlagClient {
    private baseUrl: string;
    private debug: boolean;
    private defaultTimeout: number;
    private cacheTTL: number = 0;
    private customHeaders: Record<string, string>;
    private fetch: typeof fetch;
    private flagCache: Map<string, EvaluateFlagResponse>;
    private flagsCache: Map<string, EvaluateFlagResponse[]>;
    private key: string;
    private logger: (message: string) => void = console.log;
    private retryPolicy: { retries: number; delay: number } = { retries: 3, delay: 1000 };

    constructor(config: FeatureFlagClientConfig) {
        if (!config.key || !this.validateApiKey(config.key)) {
            throw new Error("Invalid API key. The key must be a 32-character hexadecimal string.");
        }

        this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
        this.debug = config.debug || false;
        this.defaultTimeout = config.defaultTimeout || 5000;
        this.fetch = config.customFetch || fetch;
        this.customHeaders = config.customHeaders || {};
        this.flagCache = new Map();
        this.flagsCache = new Map();
        this.key = config.key;
    }

    /**
     * Evaluates multiple feature flags for a given request.
     * @param request - The request containing the environment and user details.
     * @param timeout - The maximum time (in milliseconds) to wait for the request.
     * @param retries - The number of retry attempts.
     * @returns A promise resolving to the evaluated flags or `undefined` if an error occurs.
     */
    public async evaluateFlags(
        request: EvaluateFlagsRequest,
        timeout: number = this.defaultTimeout
    ): Promise<EvaluateFlagResponse[] | undefined> {
        this.log("Evaluating flags...");
        this.validateRequest({ request, isMultiple: true });
        const cacheKey = this.getCacheKey(request);
        if (this.flagsCache.has(cacheKey)) {
            return this.flagsCache.get(cacheKey)!;
        }

        for (let attempt = 1; attempt <= this.retryPolicy.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const response = await this.fetch(`${this.baseUrl}/api/v1/evaluate/flags`, {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(request),
                });
                clearTimeout(timeoutId);

                const flags = await this.handleErrorResponse(response, "Failed to evaluate flags");
                this.log(`Flags evaluated: ${JSON.stringify(flags)}`);
                this.setCache(this.flagsCache, cacheKey, flags);
                return flags;
            } catch (error) {
                this.log(`Attempt ${attempt} failed.`);
                if (attempt === this.retryPolicy.retries) {
                    throw new Error(error.message);
                } else {
                    await new Promise((resolve) => setTimeout(resolve, this.retryPolicy.delay));
                }
            }
        }
    }

    /**
     * Evaluates one feature flag for a given request.
     * @param request - The request containing the flag key, the environment and user details.
     * @param timeout - The maximum time (in milliseconds) to wait for the request.
     * @param retries - The number of retry attempts.
     * @returns A promise resolving to the evaluated flag or `undefined` if an error occurs.
     */
    public async evaluateFlag(
        request: EvaluateFlagRequest,
        timeout: number = this.defaultTimeout
    ): Promise<EvaluateFlagResponse | undefined> {
        this.log("Evaluating flag...");
        this.validateRequest({ request });
        const cacheKey = this.getCacheKey(request);
        if (this.flagCache.has(cacheKey)) {
            return this.flagCache.get(cacheKey)!;
        }

        for (let attempt = 1; attempt <= this.retryPolicy.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const response = await this.fetch(`${this.baseUrl}/api/v1/evaluate/flag`, {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(request),
                });
                clearTimeout(timeoutId);

                const flag = await this.handleErrorResponse(response, "Failed to evaluate flag");
                this.log(`Flag evaluated: ${JSON.stringify(flag)}`);
                this.setCache(this.flagCache, cacheKey, flag);
                return flag;
            } catch (error) {
                this.log(`Attempt ${attempt} failed.`);
                if (attempt >= this.retryPolicy.retries) {
                    throw error;
                } else {
                    await new Promise((resolve) => setTimeout(resolve, this.retryPolicy.delay));
                }
            }
        }
    }

    private getHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            "x-api-key": this.key,
            ...this.customHeaders,
        };
    }

    private log(message: string): void {
        if (this.debug) {
            this.logger(`[FeatureFlagClient] ${message}`);
        }
    }

    private validateBaseUrl(baseUrl: string): boolean {
        try {
            new URL(baseUrl);
            return true;
        } catch (error) {
            return false;
        }
    }

    private validateApiKey(key: string): boolean {
        const hexRegex = /^[0-9a-f]{32}$/i;
        return hexRegex.test(key);
    }

    private validateRequest({ request, isMultiple }: ValidationProps): void {
        if (!isMultiple && !("flag" in request)) {
            throw new Error("Flag is required");
        }
        if (!request.environment) {
            throw new Error("Environment is required");
        }
        if (!request.user || !request.user.id) {
            throw new Error("User ID is required");
        }
    }

    private getCacheKey(request: EvaluateFlagsRequest): string {
        return `${request.environment}:${request.user.id}`;
    }

    private async handleErrorResponse(response: Response, errorMessage: string) {
        if (!response.ok) {
            let errorDetail = "Internal Server Error";
            const clonedResponse = response.clone();
            try {
                const errorResponse = await clonedResponse.json();
                errorDetail = errorResponse.error ?? errorDetail;
            } catch (jsonError) {
                const rawError = await response.text();
                errorDetail = rawError ?? errorDetail;
            }
            throw new Error(`${errorMessage}: ${errorDetail}`);
        }
        return response.json();
    }

    /**
     * Enables or disables debug logging.
     * @param enabled - Whether debug logging should be enabled.
     */
    public setDebug(enabled: boolean): void {
        this.debug = enabled;
        this.log(`Debug logging ${enabled ? "enabled" : "disabled"}.`);
    }

    /**
     * Updates the base URL for API requests.
     * @param baseUrl - The new base URL.
     */
    public setBaseUrl(baseUrl: string): void {
        if (!this.validateBaseUrl(baseUrl)) {
            throw new Error(`Invalid base URL: ${baseUrl}`);
        }
        this.baseUrl = baseUrl;
        this.log(`Base URL updated to: ${baseUrl}`);
    }

    /**
     * Resets the base URL to the default production URL.
     */
    public resetBaseUrl(): void {
        this.baseUrl = DEFAULT_BASE_URL;
        this.log(`Base URL reset to: ${this.baseUrl}`);
    }

    /**
     * Updates the API key for authentication.
     * @param key - The new API key.
     */
    public setApiKey(key: string): void {
        if (!key) {
            throw new Error("API key is required");
        }
        this.key = key;
        this.log("API key updated.");
    }

    /**
     * Sets the retry policy for API requests.
     * @param retries - The number of retry attempts.
     * @param delay - The delay between retries in milliseconds.
     */
    public setRetryPolicy(retries: number, delay: number): void {
        this.retryPolicy = { retries, delay };
        this.log(`Retry policy updated: ${retries} retries with ${delay}ms delay.`);
    }

    /**
     * Updates the custom headers for API requests.
     * @param headers - The new custom headers.
     */
    public setCustomHeaders(headers: Record<string, string>): void {
        this.customHeaders = headers;
        this.log("Custom headers updated.");
    }

    private setCache<T>(cache: Map<string, T>, key: string, value: T): void {
        cache.set(key, value);
        if (this.cacheTTL > 0) {
            setTimeout(() => cache.delete(key), this.cacheTTL);
        }
    }

    /**
     * Sets the cache time-to-live (TTL) in milliseconds.
     * @param ttl - The TTL in milliseconds.
     */
    public setCacheTTL(ttl: number): void {
        this.cacheTTL = ttl;
        this.log(`Cache TTL set to: ${ttl}ms.`);
    }

    /**
     * Sets a custom logger function.
     * @param logger - The logger function.
     */
    public setLogger(logger: (message: string) => void): void {
        this.logger = logger;
        this.log("Custom logger set.");
    }

    /**
     * Gets the current size of the flag and flags caches.
     * @returns An object containing the cache sizes.
     */
    public getCacheSize(): { flagCache: number; flagsCache: number } {
        return {
            flagCache: this.flagCache.size,
            flagsCache: this.flagsCache.size,
        };
    }

    /**
     * Clears the cache for both single and multiple flag evaluations.
     */
    public clearCache(): void {
        this.flagCache.clear();
        this.flagsCache.clear();
        this.log("Cache cleared.");
    }

    /**
     * Updates the default timeout for API requests.
     * @param timeout - The new default timeout (in milliseconds).
     */
    public setTimeout(timeout: number): void {
        this.defaultTimeout = timeout;
        this.log(`Default timeout updated to: ${timeout}ms`);
    }

    /**
     * Gets the current configuration of the client.
     * @returns An object containing the current configuration.
     */
    public getConfig(): FeatureFlagClientConfig {
        return {
            key: this.key,
            baseUrl: this.baseUrl,
            debug: this.debug,
            defaultTimeout: this.defaultTimeout,
            customHeaders: this.customHeaders,
        };
    }
}

export default FeatureFlagClient;
