# Production deploy script (Docker image) — design

Status: draft, awaiting approval. Date: 2026-11-14.

## Intent

Deploy the LMS to the production machine from a Docker image, with a single script run from the operator's machine or on the server. Deploys must not put the database at risk: every deploy takes a backup first, and the script never changes the schema unless asked.

## Approach (revised by the user)

The laptop is the only build and deploy machine. There is no registry and no GitHub Actions deploy.

1. The laptop builds the image from a git ref (default `main`), from a clean export of that ref, not the working tree.
2. The image is copied to the server over SSH with `docker save | ssh <host> docker load`.
3. The server runs Docker Compose. The script restarts the app container with the new image.

The "first-time setup" command prepares a new server: installs nothing without asking, checks Docker, creates the directories and the env file, and starts the stack.

## Goals

- One command deploys a named image tag: `scripts/deploy/deploy.sh <tag>`.
- A backup of the site database is taken before any change, and the script refuses to continue if the backup fails.
- The previous image tag is recorded, so a rollback is one command.
- The script can be run as a dry run that prints every step without changing anything.

## Non-goals

- No automatic `bench migrate`. Migrations run only with an explicit `--migrate` flag, after a backup.
- No changes to the database directly (no SQL, no drops, no restores over live data). Restores are a separate, manual command.
- No Kubernetes, no managed-host integration.
- No change to the developer setup in `docker/`.

## Constraints

- The production machine runs Docker and Docker Compose. The operator has SSH access and Docker permissions there.
- The laptop runs Docker with buildx. The image is never pushed to a registry.
- The site name and the database root password live in an env file on the server, never in the repo.
- The image is built on the laptop from the git ref given with `--ref`, default `main`. The repo has no local or remote `main` branch yet, so the ref must be chosen before the first deploy.

## Design

### Files

- `docker/compose.prod.yml`: production compose file. Uses the image from `${LMS_IMAGE}`. No developer mode, no published DB or Redis ports, no source mounts. The app container runs `bench serve` under a production server, not the dev server.
- `scripts/deploy/deploy.sh`: the deploy script. Reads `deploy.env` on the server.
- `scripts/deploy/deploy.env.example`: the variables the script needs, with no secrets.

### Steps (in order)

1. **Pre-checks.** Docker and Compose present; `deploy.env` present; the image tag exists in the registry (`docker manifest inspect`); disk space above a threshold.
2. **Record the current state.** The running image tag is written to `state/previous-tag` so rollback knows where to go.
3. **Backup.** Run `bench --site <site> backup --with-files` inside the running app container. Copy the backup out of the container to the server's backup directory. Abort the deploy if this fails.
4. **Pull** the new image.
5. **Restart** the app container with the new image. No database container is restarted.
6. **Migrate** only with `--migrate`. Runs `bench --site <site> migrate` after the backup.
7. **Health check.** Poll `/api/method/ping` until it answers 200 or time out. On timeout, roll back.
8. **Record** the new tag as the current deployed tag.

### Rollback

`scripts/deploy/deploy.sh --rollback` restarts the app with the tag in `state/previous-tag`. It never restores a database. A database restore is a separate manual step that uses the backup from step 3.

### Dry run

`--dry-run` prints each step and the commands it would run, and performs none of them.

## Decided by me (to confirm)

1. **Backup always runs, even without `--migrate`.** Cheap insurance, and the backup is the only restore point if a bad image breaks the app.
2. **The DB and Redis containers are never restarted by the script.** Only the app container changes. A DB restart is an operator decision.
3. **Migrations are opt-in.** A new image that needs a migration will not change the schema until someone passes `--migrate`.
4. **Backups kept for 14 days.** Older backups are listed, not deleted automatically.
5. **The script runs on the laptop and reaches the server over SSH.** The server only needs Docker and Compose.

## Things the operator must do once

- Choose the git ref to deploy (`main` does not exist yet in this repo).
- Give the SSH host, user, and public domain for the production machine.
- Run the first-time setup command, which creates `deploy.env` on the server with prompts.

## Left to the builder

- Exact backup directory layout and file naming.
- Exact timeouts and polling interval for the health check.
- Exact output format of `--dry-run`.
