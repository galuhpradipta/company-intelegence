import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { Client } from "pg";

interface ParsedArgs {
  headed: boolean;
  ui: boolean;
  keepDb: boolean;
  docker: boolean;
  passthrough: string[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDatabaseUrl = process.env.DATABASE_URL;
  const useDocker = args.docker || process.env.E2E_USE_DOCKER === "1";
  const explicitIntegrationDatabaseUrl = useDocker ? undefined : process.env.E2E_DATABASE_URL;

  if (!useDocker && !sourceDatabaseUrl) {
    throw new Error("DATABASE_URL must be set before running integration E2E tests.");
  }

  const target = useDocker
    ? await startDockerDatabase()
    : await prepareLocalDatabase({
        sourceDatabaseUrl: sourceDatabaseUrl!,
        explicitIntegrationDatabaseUrl,
      });

  const childEnv = {
    ...process.env,
    DATABASE_URL: target.integrationDatabaseUrl,
    NODE_ENV: "test",
    MERCLEX_MOCK_EXTERNAL_PROVIDERS: "1",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "test-openai-key",
  };

  try {
    console.log(`[e2e:integration] Migrating ${target.label}`);
    await runCommand("pnpm", ["db:migrate"], childEnv);

    const playwrightArgs = [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.integration.config.ts",
      ...args.passthrough,
    ];

    if (args.headed) playwrightArgs.push("--headed");
    if (args.ui) playwrightArgs.push("--ui");

    console.log(`[e2e:integration] Running Playwright against ${target.label}`);
    await runCommand("pnpm", playwrightArgs, childEnv);
  } finally {
    if (args.keepDb) {
      console.log(`[e2e:integration] Keeping ${target.label} for inspection`);
    } else {
      await target.cleanup();
    }
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const passthrough: string[] = [];
  let headed = false;
  let ui = false;
  let keepDb = false;
  let docker = false;

  for (const arg of argv) {
    if (arg === "--headed") {
      headed = true;
      continue;
    }
    if (arg === "--ui") {
      ui = true;
      continue;
    }
    if (arg === "--keep-db") {
      keepDb = true;
      continue;
    }
    if (arg === "--docker") {
      docker = true;
      continue;
    }
    passthrough.push(arg);
  }

  return { headed, ui, keepDb, docker, passthrough };
}

function createDatabaseName() {
  return `merclex_e2e_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function buildDatabaseUrl(sourceDatabaseUrl: string, databaseName: string) {
  const url = new URL(sourceDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function prepareLocalDatabase(input: {
  sourceDatabaseUrl: string;
  explicitIntegrationDatabaseUrl?: string;
}) {
  const dbName = input.explicitIntegrationDatabaseUrl
    ? new URL(input.explicitIntegrationDatabaseUrl).pathname.replace(/^\//, "") || "e2e_database"
    : createDatabaseName();
  const integrationDatabaseUrl = input.explicitIntegrationDatabaseUrl ?? buildDatabaseUrl(input.sourceDatabaseUrl, dbName);
  const adminDatabaseUrl = process.env.E2E_DATABASE_ADMIN_URL ?? input.sourceDatabaseUrl;
  const shouldCreateDatabase = !input.explicitIntegrationDatabaseUrl;

  if (shouldCreateDatabase) {
    console.log(`[e2e:integration] Creating isolated database ${dbName}`);
    await createDatabase(adminDatabaseUrl, dbName);
  } else {
    console.log(`[e2e:integration] Resetting configured integration database ${dbName}`);
    await resetDatabase(integrationDatabaseUrl);
  }

  return {
    label: `database ${dbName}`,
    integrationDatabaseUrl,
    cleanup: async () => {
      if (!shouldCreateDatabase) {
        console.log(`[e2e:integration] Keeping configured database ${dbName}`);
        return;
      }

      console.log(`[e2e:integration] Dropping isolated database ${dbName}`);
      await dropDatabase(adminDatabaseUrl, dbName);
    },
  };
}

async function startDockerDatabase() {
  const database = process.env.E2E_DOCKER_DB_NAME ?? "merclex_e2e";
  const user = process.env.E2E_DOCKER_USER ?? "postgres";
  const password = process.env.E2E_DOCKER_PASSWORD ?? "postgres";
  const image = process.env.E2E_DOCKER_IMAGE ?? "postgres:16-alpine";
  const hostPort = process.env.E2E_DOCKER_PORT
    ? Number(process.env.E2E_DOCKER_PORT)
    : await getAvailablePort();
  const containerName = `${process.env.E2E_DOCKER_CONTAINER_PREFIX ?? "merclex-e2e"}-${randomUUID().slice(0, 8)}`;
  const integrationDatabaseUrl = buildPostgresUrl({
    user,
    password,
    host: "127.0.0.1",
    port: hostPort,
    database,
  });

  console.log(`[e2e:integration] Starting Docker Postgres ${containerName} on port ${hostPort}`);
  try {
    await runCommand("docker", [
      "run",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_DB=${database}`,
      "-e",
      `POSTGRES_USER=${user}`,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      `127.0.0.1:${hostPort}:5432`,
      image,
    ], process.env);
  } catch (error) {
    throw toDockerStartupError(error);
  }

  try {
    await waitForDatabase(integrationDatabaseUrl);
  } catch (error) {
    await stopDockerContainer(containerName).catch(() => undefined);
    throw error;
  }

  return {
    label: `docker container ${containerName}`,
    integrationDatabaseUrl,
    cleanup: async () => {
      console.log(`[e2e:integration] Stopping Docker Postgres ${containerName}`);
      await stopDockerContainer(containerName);
    },
  };
}

async function createDatabase(adminDatabaseUrl: string, databaseName: string) {
  const client = new Client({ connectionString: adminDatabaseUrl });

  try {
    await client.connect();
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if (isPermissionDeniedCreateDatabase(error)) {
      throw new Error(
        [
          `permission denied to create database "${databaseName}"`,
          "Set E2E_DATABASE_URL to a pre-provisioned test database, or use a PostgreSQL role with CREATEDB.",
        ].join(". "),
      );
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function resetDatabase(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function dropDatabase(adminDatabaseUrl: string, databaseName: string) {
  const client = new Client({ connectionString: adminDatabaseUrl });

  try {
    await client.connect();
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function stopDockerContainer(containerName: string) {
  await runCommand("docker", ["rm", "-f", containerName], process.env);
}

async function waitForDatabase(databaseUrl: string) {
  const timeoutMs = 30_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end().catch(() => undefined);
      return;
    } catch {
      await client.end().catch(() => undefined);
      await delay(500);
    }
  }

  throw new Error(`Timed out waiting for PostgreSQL to become ready: ${databaseUrl}`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailablePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a local TCP port.")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function buildPostgresUrl(input: {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}) {
  const url = new URL(`postgresql://${input.host}`);
  url.username = input.user;
  url.password = input.password;
  url.port = String(input.port);
  url.pathname = `/${input.database}`;
  return url.toString();
}

function isPermissionDeniedCreateDatabase(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42501",
  );
}

function toDockerStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Cannot connect to the Docker daemon")) {
    return new Error(
      [
        "Docker daemon is not running",
        "start Docker Desktop or your local Docker engine, then rerun pnpm test:e2e:integration:docker",
      ].join(". "),
    );
  }

  return error instanceof Error ? error : new Error(message);
}

main().catch((error) => {
  console.error("[e2e:integration] Failed:", error);
  process.exit(1);
});
