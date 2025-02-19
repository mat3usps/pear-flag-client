import { enableFetchMocks } from "jest-fetch-mock";
enableFetchMocks();

import FeatureFlagClient, { DEFAULT_BASE_URL } from "../src/FeatureFlagClient";
import { EvaluateFlagRequest, EvaluateFlagResponse, EvaluateFlagsRequest } from "../src/types";

describe("FeatureFlagClient", () => {
    let client: FeatureFlagClient;

    beforeEach(() => {
        // Reset fetch mock before each test
        fetchMock.resetMocks();

        // Initialize the client
        client = new FeatureFlagClient({
            key: "0da8f357ce7a2b01effe5992f295a592",
            baseUrl: "https://api.example.com",
        });
    });

    describe("evaluateFlags", () => {
        it("should evaluate flags successfully", async () => {
            const mockResponse: EvaluateFlagResponse[] = [
                { flag: "feature1", enabled: true },
                { flag: "feature2", enabled: false },
            ];
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
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

        it("should handle API errors", async () => {
            fetchMock.mockResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            await expect(client.evaluateFlags(request)).rejects.toThrow(
                "Failed to evaluate flags: Internal Server Error"
            );
        });

        it("should handle invalid JSON responses", async () => {
            fetchMock.mockResponse("Invalid JSON", { status: 500 });

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            await expect(client.evaluateFlags(request)).rejects.toThrow("Failed to evaluate flags: Invalid JSON");
        });
    });

    describe("evaluateFlag", () => {
        it("should evaluate a single flag successfully", async () => {
            const mockResponse: EvaluateFlagResponse = { flag: "feature1", enabled: true };
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const request: EvaluateFlagRequest = {
                flag: "flag-example",
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
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

        it("should handle API errors", async () => {
            fetchMock.mockResponse(JSON.stringify({ error: "Custom error message" }), { status: 500 });

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            await expect(client.evaluateFlags(request)).rejects.toThrow(
                "Failed to evaluate flags: Custom error message"
            );
        });

        it("should handle invalid JSON responses", async () => {
            fetchMock.mockResponse("Invalid JSON", { status: 500 });

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            await expect(client.evaluateFlags(request)).rejects.toThrow("Failed to evaluate flags: Invalid JSON");
        });
    });

    describe("setApiKey", () => {
        it("should update the API key", () => {
            const customConfig = {
                key: "0da8f357ce7a2b01effe5992f295a592",
                baseUrl: "https://api.example.com",
                debug: true,
                defaultTimeout: 5697,
                customHeaders: { chedar: "cheese" },
            };
            client = new FeatureFlagClient(customConfig);

            expect(client.getConfig()).toStrictEqual(customConfig);
        });
    });

    describe("setBaseUrl", () => {
        it("should update the base URL", () => {
            client.setBaseUrl("https://new-api.example.com");
            expect(client.getConfig().baseUrl).toBe("https://new-api.example.com");
        });

        it("should throw an error for invalid URLs", () => {
            expect(() => client.setBaseUrl("invalid-url")).toThrow("Invalid base URL: invalid-url");
        });
    });

    describe("setLogger & setDebug", () => {
        it("should set custom logger and toggle debug mode", () => {
            const customLogger = jest.fn();
            const customLogger2 = jest.fn();

            expect(customLogger).not.toHaveBeenCalled();
            client.setDebug(true);
            client.setLogger(customLogger);
            expect(customLogger).toHaveBeenCalledTimes(1);
            expect(customLogger).toHaveBeenCalledWith("[FeatureFlagClient] Custom logger set.");

            client.setDebug(true);
            expect(customLogger).toHaveBeenCalledTimes(2);
            expect(customLogger).toHaveBeenCalledWith("[FeatureFlagClient] Debug logging enabled.");

            client.setDebug(false);
            client.setLogger(customLogger2);
            expect(customLogger2).not.toHaveBeenCalled();
        });
    });

    describe("resetBaseUrl", () => {
        it("should reset the base URL", () => {
            client.setBaseUrl("https://new-api.example.com");
            expect(client.getConfig().baseUrl).toBe("https://new-api.example.com");

            client.resetBaseUrl();
            expect(client.getConfig().baseUrl).toBe(DEFAULT_BASE_URL);
        });
    });

    describe("setApiKey", () => {
        it("should update the API key", () => {
            client.setApiKey("new-api-key");
            expect(client.getConfig().key).toBe("new-api-key");
        });

        it("should throw an error for empty API keys", () => {
            expect(() => client.setApiKey("")).toThrow("API key is required");
        });
    });

    describe("setRetryPolicy", () => {
        it.each([
            [0, 1000],
            [11, 200],
        ])("should update retry policy", (retries, delay) => {
            const customLogger = jest.fn();
            client.setLogger(customLogger);
            client.setDebug(true);

            client.setRetryPolicy(retries, delay);
            expect(customLogger).toHaveBeenCalledWith(
                `[FeatureFlagClient] Retry policy updated: ${retries} retries with ${delay}ms delay.`
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
        it.each([1000, 3333])("should update cache time-to-live", (cacheTtl) => {
            const customLogger = jest.fn();
            client.setLogger(customLogger);
            client.setDebug(true);

            client.setCacheTTL(cacheTtl);
            expect(customLogger).toHaveBeenCalledWith(`[FeatureFlagClient] Cache TTL set to: ${cacheTtl}ms.`);
        });
    });

    describe("clearCache", () => {
        it("should clear the cache", async () => {
            const mockResponse: EvaluateFlagResponse[] = [
                { flag: "feature1", enabled: true },
                { flag: "feature2", enabled: false },
            ];
            fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

            const request: EvaluateFlagsRequest = {
                environment: "production",
                user: { id: "user1", email: "user1@example.com" },
            };
            await client.evaluateFlags(request);
            expect(client.getCacheSize()).toEqual({ flagCache: 0, flagsCache: 1 });

            client.clearCache();
            expect(client.getCacheSize()).toEqual({ flagCache: 0, flagsCache: 0 });
        });
    });

    describe("setTimeout", () => {
        it.each([5000, 123])("should update the API key", (time) => {
            client.setTimeout(time);
            expect(client.getConfig().defaultTimeout).toBe(time);
        });
    });
});
