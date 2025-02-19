export type User = {
    id: string;
    email: string;
};

export type EvaluateFlagsRequest = {
    environment: string;
    user: User;
};

export type EvaluateFlagRequest = EvaluateFlagsRequest & {
    flag: string;
};

export type ValidationProps = {
    request: EvaluateFlagsRequest | EvaluateFlagRequest;
    isMultiple?: boolean;
};

export type EvaluateFlagResponse = {
    flag: string;
    enabled: boolean;
};

export type PearFlagClientConfig = {
    key: string;
    baseUrl?: string;
    customFetch?: typeof fetch;
    customHeaders?: Record<string, string>;
    debug?: boolean;
    defaultTimeout?: number;
};
