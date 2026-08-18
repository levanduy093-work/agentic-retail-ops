import { spawnSync } from "node:child_process";

const dockerInfo = spawnSync("docker", ["info"], {
  stdio: "ignore",
});

if (dockerInfo.error || dockerInfo.status !== 0) {
  console.error(
    "Local development requires Docker Desktop to be running before Medusa starts. Start Docker Desktop, then rerun the command.",
  );
  process.exit(1);
}

const services = spawnSync(
  "docker",
  ["compose", "up", "-d", "postgres", "redis", "qdrant"],
  { stdio: "inherit" },
);

if (services.status !== 0) {
  console.error(
    "Unable to start the local Postgres, Redis, and Qdrant services.",
  );
  process.exit(1);
}
