# Environment Variables Reference

Environment variables configure your Frappe Docker setup. They can be set directly in the container or defined in a `.env` file referenced by Docker Compose.

**Getting Started:**

```bash
cp example.env .env
```

Then edit `.env` and set variables according to your needs.

---

## Required Variables

| Variable          | Purpose                                          | Example                          | Notes                                                            |
| ----------------- | ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| `FRAPPE_PATH`     | Frappe framework path                            | https://github.com/frappe/frappe |                                                                  |
| `FRAPPE_BRANCH`   | Frappe Branch                                    | `version-15`                     | See [Frappe releases](https://github.com/frappe/frappe/releases) |
| `ERPNEXT_VERSION` | ERPNext release version                          | `v15.67.0`                       | Required although its never used                                 |
| `DB_PASSWORD`     | Password for database root (MariaDB or Postgres) | `secure_password_123`            | Not needed if using `DB_PASSWORD_SECRETS_FILE`                   |

---

## Database Configuration

| Variable                   | Purpose                                   | Default                              | When to Set                        |
| -------------------------- | ----------------------------------------- | ------------------------------------ | ---------------------------------- |
| `DB_PASSWORD`              | Database root user password               | 123                                  | Always (unless using secrets file) |
| `DB_PASSWORD_SECRETS_FILE` | Path to file containing database password | —                                    | Setup mariadb-secrets overrider    |
| `DB_HOST`                  | Database hostname or IP                   | `db` (service name)                  | Only if using external database    |
| `DB_PORT`                  | Database port                             | `3306` (MariaDB) / `5432` (Postgres) | Only if using external database    |

---

## Redis Configuration

| Variable      | Purpose                                             | Default                      | When to Set                           |
| ------------- | --------------------------------------------------- | ---------------------------- | ------------------------------------- |
| `REDIS_CACHE` | Redis hostname for caching                          | `redis-cache` (service name) | Only if using external Redis instance |
| `REDIS_QUEUE` | Redis hostname for job queues and real-time updates | `redis-queue` (service name) | Only if using external Redis instance |

---

## HTTPS & SSL Configuration

| Variable            | Purpose                                          | Default | When to Set                              |
| ------------------- | ------------------------------------------------ | ------- | ---------------------------------------- |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt certificate registration | —       | Required if using HTTPS override         |
| `SITES`             | List of domains for SSL certificates             | —       | Required if using reverse proxy override |

**Format for `SITES`:**

```bash
# Single site
SITES=`mysite.example.com`

# Wildcard (any subdomain)
SITES=`{any:.+}`
```

---

## Site Configuration

| Variable                  | Purpose                          | Default                                  | When to Set                                     |
| ------------------------- | -------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `FRAPPE_SITE_NAME_HEADER` | Site name for multi-tenant setup | `$host` (resolved from request hostname) | When accessing by IP or need explicit site name |

**Examples:**

If your site is named `mysite` but you want to access it via `127.0.0.1`:

```bash
FRAPPE_SITE_NAME_HEADER=mysite
```

If your site is named `example.com` and you access it via that domain, no need to set this (defaults to hostname).

---

## Image Configuration

| Variable         | Purpose                        | Default               | Notes                                                   |
| ---------------- | ------------------------------ | --------------------- | ------------------------------------------------------- |
| `CUSTOM_IMAGE`   | Custom Docker image repository | Frappe official image | Leave empty to use default                              |
| `CUSTOM_TAG`     | Custom Docker image tag        | Latest stable         | Corresponds to `FRAPPE_VERSION`                         |
| `PULL_POLICY`    | Image pull behavior            | `always`              | Options: `always`, `never`, `if-not-present`            |
| `RESTART_POLICY` | Container restart behavior     | `unless-stopped`      | Options: `no`, `always`, `unless-stopped`, `on-failure` |

---

## Nginx Proxy Configuration

| Variable               | Purpose                            | Default        | Allowed Values                               |
| ---------------------- | ---------------------------------- | -------------- | -------------------------------------------- |
| `BACKEND`              | Backend service address and port   | `0.0.0.0:8000` | `{host}:{port}`                              |
| `SOCKETIO`             | Socket.IO service address and port | `0.0.0.0:9000` | `{host}:{port}`                              |
| `HTTP_PUBLISH_PORT`    | Published HTTP port                | `8080`         | Any available port                           |
| `PROXY_READ_TIMEOUT`   | Upstream request timeout           | `120s`         | Any nginx timeout value (e.g., `300s`, `5m`) |
| `CLIENT_MAX_BODY_SIZE` | Maximum upload file size           | `50m`          | Any nginx size value (e.g., `100m`, `1g`)    |

### Real IP Configuration (Behind Proxy)

Use these variables when running behind a reverse proxy or load balancer:

| Variable                     | Purpose                                           | Default           |
| ---------------------------- | ------------------------------------------------- | ----------------- |
| `UPSTREAM_REAL_IP_ADDRESS`   | Trusted upstream IP address for real IP detection | `127.0.0.1`       |
| `UPSTREAM_REAL_IP_HEADER`    | Request header containing client IP               | `X-Forwarded-For` |
| `UPSTREAM_REAL_IP_RECURSIVE` | Enable recursive IP search                        | `off`             |
