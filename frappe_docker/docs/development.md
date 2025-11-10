# Getting Started

## Prerequisites

In order to start developing you need to satisfy the following prerequisites:

- Docker
- docker-compose
- user added to docker group

It is recommended you allocate at least 4GB of RAM to docker:

- [Instructions for Windows](https://docs.docker.com/docker-for-windows/#resources)
- [Instructions for macOS](https://docs.docker.com/desktop/settings/mac/#advanced)

Here is a screenshot showing the relevant setting in the Help Manual
![image](images/Docker%20Manual%20Screenshot%20-%20Resources%20section.png)
Here is a screenshot showing the settings in Docker Desktop on Mac
![images](images/Docker%20Desktop%20Screenshot%20-%20Resources%20section.png)

## Bootstrap Containers for development

Clone and change directory to frappe_docker directory

```shell
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker
```

Copy example devcontainer config from `devcontainer-example` to `.devcontainer`

```shell
cp -R devcontainer-example .devcontainer
```

Copy example vscode config for devcontainer from `development/vscode-example` to `development/.vscode`. This will setup basic configuration for debugging.

```shell
cp -R development/vscode-example development/.vscode
```

## Use VSCode Remote Containers extension

For most people getting started with Frappe development, the best solution is to use [VSCode Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

Before opening the folder in container, determine the database that you want to use. The default is MariaDB.
If you want to use PostgreSQL instead, edit `.devcontainer/docker-compose.yml` and uncomment the section for `postgresql` service, and you may also want to comment `mariadb` as well.

VSCode should automatically inquire you to install the required extensions, that can also be installed manually as follows:

- Install Dev Containers for VSCode
  - through command line `code --install-extension ms-vscode-remote.remote-containers`
  - clicking on the Install button in the Vistual Studio Marketplace: [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
  - View: Extensions command in VSCode (Windows: Ctrl+Shift+X; macOS: Cmd+Shift+X) then search for extension `ms-vscode-remote.remote-containers`

After the extensions are installed, you can:

- Open frappe_docker folder in VS Code.
  - `code .`
- Launch the command, from Command Palette (Ctrl + Shift + P) `Dev Containers: Reopen in Container`. You can also click in the bottom left corner to access the remote container menu.

Notes:

- The `development` directory is ignored by git. It is mounted and available inside the container. Create all your benches (installations of bench, the tool that manages frappe) inside this directory.
- Node v14 and v10 are installed. Check with `nvm ls`. Node v14 is used by default.

### Setup first bench

> Jump to [scripts](#setup-bench--new-site-using-script) section to setup a bench automatically. Alternatively, you can setup a bench manually using below guide.

Run the following commands in the terminal inside the container. You might need to create a new terminal in VSCode.

NOTE: Prior to doing the following, make sure the user is **frappe**.

```shell
bench init --skip-redis-config-generation frappe-bench
cd frappe-bench
```

To setup frappe framework version 14 bench set `PYENV_VERSION` environment variable to `3.10.5` (default) and use NodeJS version 16 (default),

```shell
# Use default environments
bench init --skip-redis-config-generation --frappe-branch version-14 frappe-bench
# Or set environment versions explicitly
nvm use v16
PYENV_VERSION=3.10.13 bench init --skip-redis-config-generation --frappe-branch version-14 frappe-bench
# Switch directory
cd frappe-bench
```

To setup frappe framework version 13 bench set `PYENV_VERSION` environment variable to `3.9.17` and use NodeJS version 14,

```shell
nvm use v14
PYENV_VERSION=3.9.17 bench init --skip-redis-config-generation --frappe-branch version-13 frappe-bench
cd frappe-bench
```

### Setup hosts

We need to tell bench to use the right containers instead of localhost. Run the following commands inside the container:

```shell
bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
```

For any reason the above commands fail, set the values in `common_site_config.json` manually.

```json
{
  "db_host": "mariadb",
  "redis_cache": "redis://redis-cache:6379",
  "redis_queue": "redis://redis-queue:6379",
  "redis_socketio": "redis://redis-queue:6379"
}
```

### Edit Honcho's Procfile

Note : With the option '--skip-redis-config-generation' during bench init, these actions are no more needed. But at least, take a look to ProcFile to see what going on when bench launch honcho on start command

Honcho is the tool used by Bench to manage all the processes Frappe requires. Usually, these all run in localhost, but in this case, we have external containers for Redis. For this reason, we have to stop Honcho from trying to start Redis processes.

Honcho is installed in global python environment along with bench. To make it available locally you've to install it in every `frappe-bench/env` you create. Install it using command `./env/bin/pip install honcho`. It is required locally if you wish to use is as part of VSCode launch configuration.

Open the Procfile file and remove the three lines containing the configuration from Redis, either by editing manually the file:

```shell
code Procfile
```

Or running the following command:

```shell
sed -i '/redis/d' ./Procfile
```

### Create a new site with bench

You can create a new site with the following command:

```shell
bench new-site --mariadb-user-host-login-scope=% sitename
```

sitename MUST end with .localhost for trying deployments locally.

for example:

```shell
bench new-site --mariadb-user-host-login-scope=% development.localhost
```

The same command can be run non-interactively as well:

```shell
bench new-site --db-root-password 123 --admin-password admin --mariadb-user-host-login-scope=% development.localhost
```

The command will ask the MariaDB root password. The default root password is `123`.
This will create a new site and a `development.localhost` directory under `frappe-bench/sites`.
The option `--mariadb-user-host-login-scope=%` will configure site's database credentials to work with docker.
You may need to configure your system /etc/hosts if you're on Linux, Mac, or its Windows equivalent.

To setup site with PostgreSQL as database use option `--db-type postgres` and `--db-host postgresql`. (Available only v12 onwards, currently NOT available for ERPNext).

Example:

```shell
bench new-site --db-type postgres --db-host postgresql mypgsql.localhost
```

To avoid entering postgresql username and root password, set it in `common_site_config.json`,

```shell
bench config set-common-config -c root_login postgres
bench config set-common-config -c root_password '"123"'
```

Note: If PostgreSQL is not required, the postgresql service / container can be stopped.

### Set bench developer mode on the new site

To develop a new app, the last step will be setting the site into developer mode. Documentation is available at [this link](https://frappe.io/docs/user/en/guides/app-development/how-enable-developer-mode-in-frappe).

```shell
bench --site development.localhost set-config developer_mode 1
bench --site development.localhost clear-cache
```

### Install an app

To install an app we need to fetch it from the appropriate git repo, then install in on the appropriate site:

You can check [VSCode container remote extension documentation](https://code.visualstudio.com/docs/remote/containers#_sharing-git-credentials-with-your-container) regarding git credential sharing.

To install custom app

```shell
# --branch is optional, use it to point to branch on custom app repository
bench get-app --branch version-12 https://github.com/myusername/myapp
bench --site development.localhost install-app myapp
```

At the time of this writing, the Payments app has been factored out of the Version 14 ERPNext app and is now a separate app. ERPNext will not install it.

```shell
bench get-app --branch version-14 --resolve-deps erpnext
bench --site development.localhost install-app erpnext
```

To install ERPNext (from the version-13 branch):

```shell
bench get-app --branch version-13 erpnext
bench --site development.localhost install-app erpnext
```

Note: Both frappe and erpnext must be on branch with same name. e.g. version-14
You can use the `switch-to-branch` command to align versions if you get an error about mismatching versions.

```shell
bench switch-to-branch version-xx
```

### Start Frappe without debugging

Execute following command from the `frappe-bench` directory.

```shell
bench start
```

You can now login with user `Administrator` and the password you choose when creating the site.
Your website will now be accessible at location [development.localhost:8000](http://development.localhost:8000)
Note: To start bench with debugger refer section for debugging.

### Setup bench / new site using script

Most developers work with numerous clients and versions. Moreover, apps may be required to be installed by everyone on the team working for a client.

This is simplified using a script to automate the process of creating a new bench / site and installing the required apps. The `Administrator` password for created sites is `admin`.

Sample `apps-example.json` is used by default, it installs erpnext on current stable release. To install custom apps, copy the `apps-example.json` to custom json file and make changes to list of apps. Pass this file to the `installer.py` script.

> You may have apps in private repos which may require ssh access. You may use SSH from your home directory on linux (configurable in docker-compose.yml).

```shell
python installer.py  #pass --db-type postgres for postgresdb
```

For command help

```shell
python installer.py --help
usage: installer.py [-h] [-j APPS_JSON] [-b BENCH_NAME] [-s SITE_NAME] [-r FRAPPE_REPO] [-t FRAPPE_BRANCH] [-p PY_VERSION] [-n NODE_VERSION] [-v] [-a ADMIN_PASSWORD] [-d DB_TYPE]

options:
  -h, --help            show this help message and exit
  -j APPS_JSON, --apps-json APPS_JSON
                        Path to apps.json, default: apps-example.json
  -b BENCH_NAME, --bench-name BENCH_NAME
                        Bench directory name, default: frappe-bench
  -s SITE_NAME, --site-name SITE_NAME
                        Site name, should end with .localhost, default: development.localhost
  -r FRAPPE_REPO, --frappe-repo FRAPPE_REPO
                        frappe repo to use, default: https://github.com/frappe/frappe
  -t FRAPPE_BRANCH, --frappe-branch FRAPPE_BRANCH
                        frappe repo to use, default: version-15
  -p PY_VERSION, --py-version PY_VERSION
                        python version, default: Not Set
  -n NODE_VERSION, --node-version NODE_VERSION
                        node version, default: Not Set
  -v, --verbose         verbose output
  -a ADMIN_PASSWORD, --admin-password ADMIN_PASSWORD
                        admin password for site, default: admin
  -d DB_TYPE, --db-type DB_TYPE
                        Database type to use (e.g., mariadb or postgres)
```

A new bench and / or site is created for the client with following defaults.

- MariaDB root password: `123`
- Admin password: `admin`

> To use Postegres DB, comment the mariabdb service and uncomment postegres service.

### Start Frappe with Visual Studio Code Python Debugging

To enable Python debugging inside Visual Studio Code, you must first install the `ms-python.python` extension inside the container. This should have already happened automatically, but depending on your VSCode config, you can force it by:

- Click on the extension icon inside VSCode
- Search `ms-python.python`
- Click on `Install on Dev Container: Frappe Bench`
- Click on 'Reload'

We need to start bench separately through the VSCode debugger. For this reason, **instead** of running `bench start` you should run the following command inside the frappe-bench directory:

```shell
honcho start \
    socketio \
    watch \
    schedule \
    worker_short \
    worker_long
```

Alternatively you can use the VSCode launch configuration "Honcho SocketIO Watch Schedule Worker" which launches the same command as above.

This command starts all processes with the exception of Redis (which is already running in separate container) and the `web` process. The latter can can finally be started from the debugger tab of VSCode by clicking on the "play" button.

You can now login with user `Administrator` and the password you choose when creating the site, if you followed this guide's unattended install that password is going to be `admin`.

To debug workers, skip starting worker with honcho and start it with VSCode debugger.

For advance vscode configuration in the devcontainer, change the config files in `development/.vscode`.

## Developing using the interactive console

You can launch a simple interactive shell console in the terminal with:

```shell
bench --site development.localhost console
```

More likely, you may want to launch VSCode interactive console based on Jupyter kernel.

Launch VSCode command palette (cmd+shift+p or ctrl+shift+p), run the command `Python: Select interpreter to start Jupyter server` and select `/workspace/development/frappe-bench/env/bin/python`.

The first step is installing and updating the required software. Usually the frappe framework may require an older version of Jupyter, while VSCode likes to move fast, this can [cause issues](https://github.com/jupyter/jupyter_console/issues/158). For this reason we need to run the following command.

```shell
/workspace/development/frappe-bench/env/bin/python -m pip install --upgrade jupyter ipykernel ipython
```

Then, run the command `Python: Show Python interactive window` from the VSCode command palette.

Replace `development.localhost` with your site and run the following code in a Jupyter cell:

```python
import frappe

frappe.init(site='development.localhost', sites_path='/workspace/development/frappe-bench/sites')
frappe.connect()
frappe.local.lang = frappe.db.get_default('lang')
frappe.db.connect()
```

The first command can take a few seconds to be executed, this is to be expected.

## Manually start containers

In case you don't use VSCode, you may start the containers manually with the following command:

### Running the containers

```shell
docker-compose -f .devcontainer/docker-compose.yml up -d
```

And enter the interactive shell for the development container with the following command:

```shell
docker exec -e "TERM=xterm-256color" -w /workspace/development -it devcontainer-frappe-1 bash
```

## Use additional services during development

Add any service that is needed for development in the `.devcontainer/docker-compose.yml` then rebuild and reopen in devcontainer.

e.g.

```yaml
...
services:
 ...
  postgresql:
    image: postgres:11.8
    environment:
      POSTGRES_PASSWORD: 123
    volumes:
      - postgresql-data:/var/lib/postgresql/data
    ports:
      - 5432:5432

volumes:
  ...
  postgresql-data:
```

Access the service by service name from the `frappe` development container. The above service will be accessible via hostname `postgresql`. If ports are published on to host, access it via `localhost:5432`.

## Using Cypress UI tests

To run cypress based UI tests in a docker environment, follow the below steps:

1. Install and setup X11 tooling on VM using the script `install_x11_deps.sh`

```shell
  sudo bash ./install_x11_deps.sh
```

This script will install required deps, enable X11Forwarding and restart SSH daemon and export `DISPLAY` variable.

2. Run X11 service `startx` or `xquartz`
3. Start docker compose services.
4. SSH into ui-tester service using `docker exec..` command
5. Export CYPRESS_baseUrl and other required env variables
6. Start Cypress UI console by issuing `cypress run command`

> More references : [Cypress Official Documentation](https://www.cypress.io/blog/2019/05/02/run-cypress-with-a-single-docker-command)

> Ensure DISPLAY environment is always exported.

## Using Mailpit to test mail services

To use Mailpit just uncomment the service in the docker-compose.yml file.
The Interface is then available under port 8025 and the smtp service can be used as mailpit:1025.
