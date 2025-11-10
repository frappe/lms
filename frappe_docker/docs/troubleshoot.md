1. [Fixing MariaDB issues after rebuilding the container](#fixing-mariadb-issues-after-rebuilding-the-container)
1. [docker-compose does not recognize variables from `.env` file](#docker-compose-does-not-recognize-variables-from-env-file)
1. [Windows Based Installation](#windows-based-installation)

### Fixing MariaDB issues after rebuilding the container

For any reason after rebuilding the container if you are not be able to access MariaDB correctly (i.e. `Access denied for user [...]`) with the previous configuration. Follow these instructions.

First test for network issues. Manually connect to the database through the `backend` container:

```
docker exec -it frappe_docker-backend-1 bash
mysql -uroot -padmin -hdb
```

Replace `root` with the database root user name, `admin` with the root password, and `db` with the service name specified in the docker-compose `.yml` configuration file. If the connection to the database is successful, then the network configuration is correct and you can proceed to the next step. Otherwise, modify the docker-compose `.yml` configuration file, in the `configurator` service's `environment` section, to use the container names (`frappe_docker-db-1`, `frappe_docker-redis-cache-1`, `frappe_docker-redis-queue-1` or as otherwise shown with `docker ps`) instead of the service names and rebuild the containers.

Then, the parameter `'db_name'@'%'` needs to be set in MariaDB and permission to the site database suitably assigned to the user.

This step has to be repeated for all sites available under the current bench.
Example shows the queries to be executed for site `localhost`

Open sites/localhost/site_config.json:

```shell
code sites/localhost/site_config.json
```

and take note of the parameters `db_name` and `db_password`.

Enter MariaDB Interactive shell:

```shell
mysql -uroot -padmin -hdb
```

The parameter `'db_name'@'%'` must not be duplicated. Verify that it is unique with the command:

```
SELECT User, Host FROM mysql.user;
```

Delete duplicated entries, if found, with the following:

```
DROP USER 'db_name'@'host';
```

Modify permissions by executing following queries replacing `db_name` and `db_password` with the values found in site_config.json.

```sql
-- if there is no user created already first try to created it using the next command
-- CREATE USER 'db_name'@'%' IDENTIFIED BY 'your_password';
-- skip the upgrade command below if you use the create command above
UPDATE mysql.global_priv SET Host = '%' where User = 'db_name'; FLUSH PRIVILEGES;
SET PASSWORD FOR 'db_name'@'%' = PASSWORD('db_password'); FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON `db_name`.* TO 'db_name'@'%' IDENTIFIED BY 'db_password' WITH GRANT OPTION; FLUSH PRIVILEGES;
EXIT;
```

Note: For MariaDB 10.3 and older use `mysql.user` instead of `mysql.global_priv`.

### docker-compose does not recognize variables from `.env` file

If you are using old version of `docker-compose` the .env file needs to be located in directory from where the docker-compose command is executed. There may also be difference in official `docker-compose` and the one packaged by distro. Use `--env-file=.env` if available to explicitly specify the path to file.

### Windows Based Installation

- Set environment variable `COMPOSE_CONVERT_WINDOWS_PATHS` e.g. `set COMPOSE_CONVERT_WINDOWS_PATHS=1`
- While using docker machine, port-forward the ports of VM to ports of host machine. (ports 8080/8000/9000)
- Name all the sites ending with `.localhost`. and access it via browser locally. e.g. `http://site1.localhost`

### Redo installation

- If you have made changes and just want to start over again (abandoning all changes), remove all docker
  - containers
  - images
  - volumes
- Install a fresh
