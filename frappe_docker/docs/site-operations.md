# Site operations

> 💡 You should setup `--project-name` option in `docker-compose` commands if you have non-standard project name.

## Setup new site

Note:

- Wait for the `db` service to start and `configurator` to exit before trying to create a new site. Usually this takes up to 10 seconds.
- Also you have to pass `-p <project_name>` if `-p` passed previously eg. `docker-compose -p <project_name> exec (rest of the command)`.

```sh
docker-compose exec backend bench new-site --mariadb-user-host-login-scope=% --db-root-password <db-password> --admin-password <admin-password> <site-name>
```

If you need to install some app, specify `--install-app`. To see all options, just run `bench new-site --help`.

To create Postgres site (assuming you already use [Postgres compose override](images-and-compose-files.md#overrides)) you need have to do set `root_login` and `root_password` in common config before that:

```sh
docker-compose exec backend bench set-config -g root_login <root-login>
docker-compose exec backend bench set-config -g root_password <root-password>
```

Also command is slightly different:

```sh
docker-compose exec backend bench new-site --mariadb-user-host-login-scope=% --db-type postgres --admin-password <admin-password> <site-name>
```

## Push backup to S3 storage

We have the script that helps to push latest backup to S3.

```sh
docker-compose exec backend push_backup.py --site-name <site-name> --bucket <bucket> --region-name <region> --endpoint-url <endpoint-url> --aws-access-key-id <access-key> --aws-secret-access-key <secret-key>
```

Note that you can restore backup only manually.

## Edit configs

Editing config manually might be required in some cases,
one such case is to use Amazon RDS (or any other DBaaS).
For full instructions, refer to the [wiki](<https://github.com/frappe/frappe/wiki/Using-Frappe-with-Amazon-RDS-(or-any-other-DBaaS)>). Common question can be found in Issues and on forum.

`common_site_config.json` or `site_config.json` from `sites` volume has to be edited using following command:

```sh
docker run --rm -it \
    -v <project-name>_sites:/sites \
    alpine vi /sites/common_site_config.json
```

Instead of `alpine` use any image of your choice.

## Health check

For socketio and gunicorn service ping the hostname:port and that will be sufficient. For workers and scheduler, there is a command that needs to be executed.

```shell
docker-compose exec backend healthcheck.sh --ping-service mongodb:27017
```

Additional services can be pinged as part of health check with option `-p` or `--ping-service`.

This check ensures that given service should be connected along with services in common_site_config.json.
If connection to service(s) fails, the command fails with exit code 1.

---

For reference of commands like `backup`, `drop-site` or `migrate` check [official guide](https://frappeframework.com/docs/v13/user/en/bench/frappe-commands) or run:

```sh
docker-compose exec backend bench --help
```

## Migrate site

Note:

- Wait for the `db` service to start and `configurator` to exit before trying to migrate a site. Usually this takes up to 10 seconds.

```sh
docker-compose exec backend bench --site <site-name> migrate
```
