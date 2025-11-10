# Single Compose Setup

This setup is a very simple single compose file that does everything to start required services and a frappe-bench. It is used to start play with docker instance with a site. The file is located in the root of repo and named `pwd.yml`.

## Services

### frappe-bench components

- backend, serves gunicorn backend
- frontend, serves static assets through nginx frontend reverse proxies websocket and gunicorn.
- queue-long, long default and short rq worker.
- queue-short, default and short rq worker.
- schedule, event scheduler.
- websocket, socketio websocket for realtime communication.

### Run once configuration

- configurator, configures `common_site_config.json` to set db and redis hosts.
- create-site, creates one site to serve as default site for the frappe-bench.

### Service dependencies

- db, mariadb, container with frappe specific configuration.
- redis-cache, redis for cache data.
- redis-queue, redis for rq data and pub/sub.

## Volumes

- sites: Volume for bench data. Common config, all sites, all site configs and site files will be stored here.
- logs: Volume for bench logs. all process logs are dumped here. No need to mount it. Each container will create a temporary volume for logs if not specified.

## Adaptation

If you understand containers use the `pwd.yml` as a reference to build more complex setup like, single server example, Docker Swarm stack, Kubernetes Helm chart, etc.

This serves only site called `frontend` through the nginx. `FRAPPE_SITE_NAME_HEADER` is set to `frontend` and a default site called `frontend` is created.

Change the `$$host` will allow container to accept any host header and serve that site. To escape `$` in compose yaml use it like `$$`. To unset default site remove `currentsite.txt` file from `sites` directory.
