import { enableFetchMocks } from "jest-fetch-mock";
enableFetchMocks();

import PearFlagClient, { DEFAULT_BASE_URL } from "../src/PearFlagClient";
import { EvaluateFlagRequest, EvaluateFlagResponse, EvaluateFlagsRequest } from "../src/types";

const NEW_URL = "https://new-api.example.com";

describe("PearFlagClient", () => {
    let client: PearFlagClient;

    beforeEach(() => {
        fetchMock.resetMocks();

        client = new PearFlagClient({
            key: "0da8f357ce7a2b01effe5992f295a592",
            baseUrl: "https://api.example.com",
        });
    });

    describe("initial config", () => {
        it("should set initial config", () => {
            const customConfig = {
                key: "0da8f357ce7a2b01effe5992f295a592",
                baseUrl: "https://api.example.com",
                debug: true,
                defaultTimeout: 5697,
                customHeaders: { chedar: "cheese" },
            };

            client = new PearFlagClient(customConfig);

            expect(client.getConfig()).toStrictEqual(customConfig);
        });

        it("should be set to default url if none is passed", () => {
            const client = new PearFlagClient({
                key: "0da8f357ce7a2b01effe5992f295a592",
            });

            expect(client.getConfig().baseUrl).toEqual(DEFAULT_BASE_URL);
        });

        it("should handle invalid API keys", () => {
            const customConfig = {
                key: "invalid-key",
            };

            expect(() => new PearFlagClient(customConfig)).toThrow(
                "Invalid API key. The key must be a 32-character hexadecimal string."
            );
        });

        it("should handle empty API keys", () => {
            const customConfig = {
                key: "",
            };

            expect(() => new PearFlagClient(customConfig)).toThrow(
                "Invalid API key. The key must be a 32-character hexadecimal string."
            );
        });
    });

    describe("evaluateFlags", () => {
        const mockResponse: EvaluateFlagResponse[] = [
            { flag: "feature1", enabled: true },
            { flag: "feature2", enabled: false },
        ];
        const request: EvaluateFlagsRequest = {
            environment: "production",
            user: { id: "user1", email: "user1@example.com" },
        };

        it("should evaluate flags successfully", async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const result = await client.evaluateFlags(request);
            expect(result).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/v1/evaluate/flags", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": "0da8f357ce7a2b01effe5992f295a592",
                },
                body: JSON.stringify(request),
            });
        });

        it("should respond with cached flags", async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const result1 = await client.evaluateFlags(request);
            expect(result1).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const result2 = await client.evaluateFlags(request);
            expect(result2).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it.each([
            [
                "Environment is required",
                {
                    user: { id: "user1", email: "user1@example.com" },
                },
            ],
            [
                "User ID is required",
                {
                    environment: "production",
                    user: { email: "user1@example.com" },
                },
            ],
        ])("should throw %s for an invalid request", async (error, request) => {
            fetchMock.mockResponse(JSON.stringify(mockResponse), { status: 500 });

            await expect(client.evaluateFlags(request as EvaluateFlagsRequest)).rejects.toThrow(error);
        });

        it("should handle API errors", async () => {
            fetchMock.mockResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });

            await expect(client.evaluateFlags(request)).rejects.toThrow(
                "Failed to evaluate flags: Internal Server Error"
            );
        });

        it("should handle invalid JSON responses", async () => {
            fetchMock.mockResponse("Invalid JSON", { status: 500 });

            await expect(client.evaluateFlags(request)).rejects.toThrow("Failed to evaluate flags: Invalid JSON");
        });
    });

    describe("evaluateFlag", () => {
        const mockResponse: EvaluateFlagResponse = { flag: "feature1", enabled: true };
        const request: EvaluateFlagRequest = {
            flag: "flag-example",
            environment: "production",
            user: { id: "user1", email: "user1@example.com" },
        };

        it("should evaluate a single flag successfully", async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const result = await client.evaluateFlag(request);
            expect(result).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/v1/evaluate/flag", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": "0da8f357ce7a2b01effe5992f295a592",
                },
                body: JSON.stringify(request),
            });
        });

        it("should respond with cached flag", async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const result1 = await client.evaluateFlag(request);
            expect(result1).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const result2 = await client.evaluateFlag(request);
            expect(result2).toEqual(mockResponse);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it.each([
            [
                "Flag is required",
                {
                    environment: "production",
                    user: { id: "user1", email: "user1@example.com" },
                },
            ],
            [
                "Environment is required",
                {
                    flag: "feature-1",
                    user: { id: "user1", email: "user1@example.com" },
                },
            ],
            [
                "User ID is required",
                {
                    flag: "feature-1",
                    environment: "production",
                    user: { email: "user1@example.com" },
                },
            ],
        ])("should throw %s for an invalid request", async (error, request) => {
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            await expect(client.evaluateFlag(request as EvaluateFlagRequest)).rejects.toThrow(error);
        });

        it("should handle API errors", async () => {
            fetchMock.mockResponse(JSON.stringify({ error: "Custom error message" }), { status: 500 });

            await expect(client.evaluateFlag(request)).rejects.toThrow("Failed to evaluate flag: Custom error message");
        });

        it("should handle invalid JSON responses", async () => {
            fetchMock.mockResponse("Invalid JSON", { status: 500 });

            await expect(client.evaluateFlag(request)).rejects.toThrow("Failed to evaluate flag: Invalid JSON");
        });
    });

    describe("setBaseUrl", () => {
        it("should update the base URL", () => {
            client.setBaseUrl(NEW_URL);
            expect(client.getConfig().baseUrl).toBe(NEW_URL);
        });

        it("should throw an error for empty URLs", () => {
            expect(() => client.setBaseUrl("")).toThrow("Invalid base URL: ");
        });

        it("should throw an error for invalid URLs", () => {
            expect(() => client.setBaseUrl("invalid-url")).toThrow("Invalid base URL: invalid-url");
        });
    });

    describe("setLogger & setDebug", () => {
        it("should configure custom logger and toggle debug mode", () => {
            const customLogger = jest.fn();
            const customLogger2 = jest.fn();

            expect(customLogger).not.toHaveBeenCalled();
            client.setDebug(true);
            client.setLogger(customLogger);
            expect(customLogger).toHaveBeenCalledTimes(1);
            expect(customLogger).toHaveBeenCalledWith("[PearFlagClient] Custom logger set.");

            client.setDebug(true);
            expect(customLogger).toHaveBeenCalledTimes(2);
            expect(customLogger).toHaveBeenCalledWith("[PearFlagClient] Debug logging enabled.");

            client.setDebug(false);
            client.setLogger(customLogger2);
            expect(customLogger2).not.toHaveBeenCalled();
        });
    });

    describe("resetBaseUrl", () => {
        it("should reset base URL", () => {
            client.setBaseUrl(NEW_URL);
            expect(client.getConfig().baseUrl).toBe(NEW_URL);

            client.resetBaseUrl();
            expect(client.getConfig().baseUrl).toBe(DEFAULT_BASE_URL);
        });
    });

    describe("setApiKey", () => {
        it("should update the API key", () => {
            const newApiKey = "1fa8f357ce6a2b01effe5992f295a742";
            client.setApiKey(newApiKey);

            expect(client.getConfig().key).toBe(newApiKey);
        });

        it("should throw an error for empty API keys", () => {
            expect(() => client.setApiKey("")).toThrow(
                "Invalid API key. The key must be a 32-character hexadecimal string."
            );
        });

        it("should throw an error for invalid API keys", () => {
            expect(() => client.setApiKey("invalid-key")).toThrow(
                "Invalid API key. The key must be a 32-character hexadecimal string."
            );
        });
    });

    describe("setRetryPolicy", () => {
        it.each([
            [0, 1000],
            [11, 200],
        ])("should update retry policy to %s retries and %sms delay ", (retries, delay) => {
            const customLogger = jest.fn();
            client.setLogger(customLogger);
            client.setDebug(true);
            client.setRetryPolicy(retries, delay);

            expect(customLogger).toHaveBeenCalledWith(
                `[PearFlagClient] Retry policy updated: ${retries} retries with ${delay}ms delay.`
            );
        });
    });

    describe("setCustomHeaders", () => {
        it("should update custom headers", () => {
            const customHeader = { "Crazy Header": "Awesome Header Value" };
            client.setCustomHeaders(customHeader);

            expect(client.getConfig().customHeaders).toStrictEqual(customHeader);
        });
    });

    describe("setCacheTTL", () => {
        it.each([1000, 3333])("should set cache time-to-live to %sms", (cacheTTL) => {
            const customLogger = jest.fn();
            client.setLogger(customLogger);
            client.setDebug(true);

            client.setCacheTTL(cacheTTL);
            expect(customLogger).toHaveBeenCalledWith(`[PearFlagClient] Cache TTL set to: ${cacheTTL}ms.`);
        });

        it.each([123, 300])("should delete cache after %sms of time-to-live", async (cacheTTL) => {
            jest.useFakeTimers();

            const mockResponse1: EvaluateFlagResponse[] = [];
            const mockResponse2: EvaluateFlagResponse[] = [
                { flag: "feature1", enabled: true },
                { flag: "feature2", enabled: false },
            ];
            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse1)).mockResponseOnce(JSON.stringify(mockResponse2));

            // Cache is set
            client.setCacheTTL(cacheTTL);
            const result1 = await client.evaluateFlags(request);
            expect(result1).toEqual(mockResponse1);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // Cache is valid so no call is made
            jest.advanceTimersByTime(50);
            const result2 = await client.evaluateFlags(request);
            expect(result2).toEqual(mockResponse1);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // Cache is deleted and another call is made
            jest.advanceTimersByTime(cacheTTL);
            const result3 = await client.evaluateFlags(request);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result3).toEqual(mockResponse2);

            jest.useRealTimers();
        });
    });

    describe("clearCache", () => {
        it("should clear the cache", async () => {
            const mockResponse: EvaluateFlagResponse[] = [
                { flag: "feature1", enabled: true },
                { flag: "feature2", enabled: false },
            ];
            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            await client.evaluateFlags(request);
            expect(client.getCacheSize()).toEqual({ flagCache: 0, flagsCache: 1 });

            client.clearCache();
            expect(client.getCacheSize()).toEqual({ flagCache: 0, flagsCache: 0 });
        });
    });

    describe("setTimeout", () => {
        it.each([5000, 123])("should configure timeout to %sms", (time) => {
            client.setTimeout(time);

            expect(client.getConfig().defaultTimeout).toBe(time);
        });
    });
});
