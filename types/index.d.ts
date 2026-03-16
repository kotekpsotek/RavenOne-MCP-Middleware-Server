interface FailedAttempt {
    count: number;
    resetTime: number;
}

type CredentialPasswordObj = Pick<MCPCredentials, "secretPassword">;
