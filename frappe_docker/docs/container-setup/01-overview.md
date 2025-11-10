The purpose of this document is to give you an overview of how the Frappe Docker containers are structured.

# 🐳 Images

There are **four predefined Dockerfiles** available in the `/images` directory.

| Dockerfile     | Ingredients                                                                                                                                                                  | Purpose & Use Case                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bench**      | Sets up only the Bench CLI.                                                                                                                                                  | Used for **development** or debugging. Provides the command-line tooling but does not include runtime services.                                                 |
| **custom**     | Multi-purpose Python backend built from a plain Python image. Includes everything needed to run a Frappe instance via a Compose setup. Installs apps defined in `apps.json`. | Suitable for **production** and **testing**. Ideal when you need control over dependencies (e.g. trying new Python or Node versions).                           |
| **layered**    | Final contents are the same as `custom`, but it is based on **prebuilt images from [Docker Hub](https://hub.docker.com/u/frappe)**.                                          | Great for **production builds** when you’re fine with the dependency versions managed by Frappe. Builds much faster since the base layers are already prepared. |
| **production** | Similar to `custom` (built from a Python base image), but installs **only Frappe and ERPNext**. Not customizable with `apps.json`.                                           | Best for **quick starts** or exploration. For real deployments or CI/CD pipelines, `custom` or `layered` are preferred because they offer more flexibility.     |

---

These images include everything needed to run all processes required by the Frappe framework
(see [Bench Procfile reference](https://frappeframework.com/docs/v14/user/en/bench/resources/bench-procfile)).

- The `bench` image only sets up the CLI tool.
- The other images (`custom`, `layered`, and `production`) go further — enabling a nearly **plug-and-play** setup for ERPNext and custom apps.

> We use [multi-stage builds](https://docs.docker.com/develop/develop-images/multistage-build/) and [Docker Buildx](https://docs.docker.com/engine/reference/commandline/buildx/) to maximize layer reuse and make our builds more efficient.

# 🏗️ Compose

Once images are built, containers are orchestrated using a [compose file](https://docs.docker.com/compose/compose-file/). The main compose.yaml provides core services, networking, and volumes for any Frappe setup.

## 🛠️ Services

| Service          | Role            | Purpose                                                                                                                                                                                                          |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **configurator** | Setup           | Updates `common_site_config.json` so Frappe knows how to access db and redis. It is executed on every `docker-compose up` (and exited immediately). Other services start after this container exits successfully |
| **backend**      | Runtime         | [Werkzeug server](https://werkzeug.palletsprojects.com/en/2.0.x/)                                                                                                                                                |
| **frontend**     | Proxy           | [nginx](https://www.nginx.com) server that serves JS/CSS assets and routes incoming requests                                                                                                                     |
| **websocket**    | Real-time       | Node server that runs [Socket.IO](https://socket.io)                                                                                                                                                             |
| **queue-\_**     | Background Jobs | Python servers that run job queues using [rq](https://python-rq.org)                                                                                                                                             |
| **scheduler**    | Task Automation | Python server that runs tasks on schedule using [schedule](https://schedule.readthedocs.io/en/stable/)                                                                                                           |

## 🧩 Overrides

Additional functionality can be added using [overrides](https://docs.docker.com/compose/extends/). These files modify existing services or add new ones without changing the main `compose.yaml`.

Example: The main compose file has no database service, but `compose.mariadb.yaml` adds MariaDB. See [overrider.md](overrider.md) for the complete list of available overrides and how to use them.

---

**Next:** [Build Setup →](02-build-setup.md)
