import "dotenv/config";
import express from "express";
import { MCPConfigInterface } from "./interface/config.js";

const app = express();

// Middlewares
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// SRC Routes
app.get("/ping", async (req, res) => {
    res.status(200).send("Pong!");
});

// Rate limiting store for failed auth attempts
const MAX_FAILURES = 10;
const RESET_INTERVAL_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours

const ipFailedAttempts = new Map<string, FailedAttempt>();

// Download the remaining attempts for user is calling the https server
app.get("/remaining-attempts", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const attempt = ipFailedAttempts.get(ip);
    
    if (attempt) {
        if (now > attempt.resetTime) {
            ipFailedAttempts.delete(ip);
            res.status(200).json({ remainingAttempts: MAX_FAILURES, resetTime: null });
        } else {
            res.status(200).json({ 
                remainingAttempts: Math.max(0, MAX_FAILURES - attempt.count),
                resetTime: attempt.resetTime
            });
        }
    } else {
        res.status(200).json({ remainingAttempts: MAX_FAILURES, resetTime: null });
    }
});

// Authentication check middleware -> each below route is protected by unauthenticated access
app.use(async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const attempt = ipFailedAttempts.get(ip);

    if (attempt) {
        if (now > attempt.resetTime) {
            ipFailedAttempts.delete(ip);
        } else if (attempt.count >= MAX_FAILURES) {
            res.status(429).send("Too Many Requests - Try again later.");
            return;
        }
    }

    const { secretPassword } = req.body as CredentialPasswordObj;

    if (secretPassword === process.env.SecretPassword) {
        // Optionally reset on successful login
        ipFailedAttempts.delete(ip);
        next();
    }
    else {
        const currentAttempt = ipFailedAttempts.get(ip) || { count: 0, resetTime: now + RESET_INTERVAL_MS };
        if (now > currentAttempt.resetTime) {
            currentAttempt.count = 1;
            currentAttempt.resetTime = now + RESET_INTERVAL_MS;
        } else {
            currentAttempt.count += 1;
        }
        ipFailedAttempts.set(ip, currentAttempt);

        res.sendStatus(401);
    }
});

// Config routes
app.post("/is-connectable", async (req, res) => {
    // Because is below the middleware
    res.sendStatus(200);
})

app.route("/mcp-config")
.get(async (req, res) => { // Download mcp config
    // 1. Read
    const mcpConfigStringJSON = new MCPConfigInterface().read();

    // 2. Response
    if (mcpConfigStringJSON.length) {
        res.status(200).send(mcpConfigStringJSON);    
    }
    else res.sendStatus(404);
})
.post(async (req, res) => { // Save MCP Config change
    /** mcpConfig - it overwrites the prior config so it's to be the configuration with previous servers or removed old */
    const { mcpConfig } = req.body as { mcpConfig: string };
    const interfaceMCPConfig = new MCPConfigInterface();
    
    // 0.5. Check is valid
    if (!interfaceMCPConfig.checkIsValidMCPConfig(mcpConfig)) {
        res.sendStatus(400);
        return;
    }
    
    // 1. Write
    const _mcpConfigStringJSON = interfaceMCPConfig.write(mcpConfig);

    // 2. Response
    res.sendStatus(200);
})

// TODO: Tool usage routes from 1st point of TODO.md
