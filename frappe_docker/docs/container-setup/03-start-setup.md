# start Container

Once your compose file is ready, start all containers with a single command:

```bash
docker compose -p frappe -f compose.custom.yaml up -d
```

```bash
podman-compose --in-pod=1 --project-name frappe -f compose.custom.yaml up -d
```

The `-p` (or `--project-name`) flag names the project `frappe`, allowing you to easily reference and manage all containers together.

# Create a site and install apps

Frappe is now running, but it's not yet configured. You need to create a site and install your apps.

```bash
docker compose -p frappe exec backend bench new-site <sitename> --mariadb-user-host-login-scope='172.%.%.%'
docker compose -p frappe exec backend bench --site <sitename> install-app erpnext
```

```bash
podman exec -ti erpnext_backend_1 /bin/bash
bench new-site <sitename> --mariadb-user-host-login-scope='172.%.%.%'
bench --site <sitename> install-app erpnext
```

Replace `<sitename>` with your desired site name.

> ## Understanding the MariaDB User Scope
>
> The flag --mariadb-user-host-login-scope='172.%.%.%' allows database connections from any IP address within the 172.0.0.0/8 range. This includes all containers and virtual machines running on your machine.
>
> **Why is this necessary?** Docker and Podman assign dynamic IP addresses to containers. If you set a fixed IP address instead, database connections will fail when the container restarts and receives a new IP. The wildcard pattern ensures connections always work, regardless of IP changes.
>
> **Security note:** This scope is sufficient because only the backend container accesses the database. If you need external database access, adjust the scope accordingly, but be cautious with overly permissive settings.

---

**Back:** [Build Setup →](02-build-setup.md)
