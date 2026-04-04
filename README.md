# MCP Client Middleware Server

Express-based middleware server that exposes HTTP endpoints for RavenOne to manage MCP configuration, list MCP servers, fetch tool metadata, and execute MCP tool calls.

## What Changed For Docker

- Added a production TypeScript build that emits to `dist/`.
- Removed private `@ravenlens/*` package dependencies from the runtime build path.
- Added a multi-stage Dockerfile and a local `compose.yaml`.
- Replaced committed MCP token content with placeholders and added a safe example config.
- Added a GitHub Actions workflow to publish images to Docker Hub.

## Local Setup

1. Copy `.env.example` to `.env` and set a strong `SecretPassword`.
2. Copy `config/mcpConfig.example.json` to `config/mcpConfig.json`.
3. Update `config/mcpConfig.json` with your MCP server entries and tokens.
4. Install dependencies with `npm install`.
5. Run locally with `npm run dev` or build and run with `npm run build` then `npm start`.

## Configuration

Environment variables:

- `PORT`: HTTP port. Default is `8000`.
- `ConfigFilePath`: Path to the MCP config file. Default is `./config/mcpConfig.json`.
- `SecretPassword`: Shared secret expected in request bodies for protected routes.

MCP config file:

- Use `config/mcpConfig.json` for real credentials.
- Keep `config/mcpConfig.json` out of source control.
- Use `config/mcpConfig.example.json` as the template for public distribution.

## Docker

Build the image:

```powershell
docker build -t mcp-client-middleware-server:local .
```

Run the container in PowerShell:

```powershell
docker run --rm `
  -p 8000:8000 `
  --env-file .env `
  -e ConfigFilePath=/app/config/mcpConfig.json `
  -v ${PWD}/config/mcpConfig.json:/app/config/mcpConfig.json:ro `
  mcp-client-middleware-server:local
```

Or start it with Compose:

```powershell
docker compose up --build
```

Health check:

- The image exposes `/ping` and includes a container health check against that endpoint.

## RavenOne Setup

1. Deploy this service where RavenOne can reach it, for example behind HTTPS on a stable hostname.
2. Set `SecretPassword` in the server `.env` file.
3. In RavenOne, open the MCP server settings for the integration.
4. Use the deployed service base URL and the same secret value as the API key or shared secret RavenOne sends.
5. Verify connectivity through the service health endpoint and the protected `POST /is-connectable` route.
6. Manage the actual MCP server list through `POST /mcp-config` or by mounting/updating `config/mcpConfig.json`.

Relevant routes:

- `GET /ping`
- `GET /remaining-attempts`
- `POST /is-connectable`
- `PUT /mcp-config`
- `POST /mcp-config`
- `POST /mcp-servers-list`
- `POST /get-mcp-servers-tools`
- `POST /call-tool`
- `POST /call-tools`

## Publishing To GitHub And Docker Hub

GitHub:

1. Remove any remaining real secrets from tracked files.
2. Push this repository to a public GitHub repository.
3. Add Docker Hub credentials as GitHub repository secrets:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

Docker Hub:

1. Create a public Docker Hub repository named `mcp-client-middleware-server`.
2. In GitHub, use the included workflow at `.github/workflows/docker-publish.yml`.
3. Trigger it manually or push a Git tag such as `v1.0.0`.
4. The workflow builds the image and publishes it to `docker.io/<your-user>/mcp-client-middleware-server`.

Manual publish alternative:

```powershell
docker login
docker build -t <dockerhub-user>/mcp-client-middleware-server:latest .
docker push <dockerhub-user>/mcp-client-middleware-server:latest
```

## About Docker Marketplace

For most teams, the target is a public Docker Hub repository, not the older Docker Marketplace program. If you want broad public access, publish the image to Docker Hub and keep the source repository public on GitHub. If you need a verified or commercial listing, that is a separate Docker publisher process handled in Docker Hub organization settings.