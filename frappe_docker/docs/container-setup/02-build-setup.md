This guide walks you through building Frappe images from the repository resources.

# Prerequisites

- git
- docker or podman
- docker compose v2 or podman compose

> Install containerization software according to the official maintainer documentation. Avoid package managers when not recommended, as they frequently cause compatibility issues.

# Clone this repo

```bash
git clone https://github.com/frappe/frappe_docker
cd frappe_docker
```

# Define custom apps

If you dont want to install specific apps to the image skip this section.

To include custom apps in your image, create an `apps.json` file in the repository root:

```json
[
  {
    "url": "https://github.com/frappe/erpnext",
    "branch": "version-15"
  },
  {
    "url": "https://github.com/frappe/hrms",
    "branch": "version-15"
  },
  {
    "url": "https://github.com/frappe/helpdesk",
    "branch": "main"
  }
]
```

Then generate a base64-encoded string from this file:

```bash
export APPS_JSON_BASE64=$(base64 -w 0 apps.json)
```

# Build the image

Choose the appropriate build command based on your container runtime and desired image type. This example builds the `layered` image with the custom `apps.json` you created.

`Docker`:

```bash
docker build \
 --build-arg=FRAPPE_PATH=https://github.com/frappe/frappe \
 --build-arg=FRAPPE_BRANCH=version-15 \
 --build-arg=APPS_JSON_BASE64=$APPS_JSON_BASE64 \
 --tag=custom:15 \
 --file=images/layered/Containerfile .
```

`Podman`:

```bash
podman build \
 --build-arg=FRAPPE_PATH=https://github.com/frappe/frappe \
 --build-arg=FRAPPE_BRANCH=version-15 \
 --build-arg=APPS_JSON_BASE64=$APPS_JSON_BASE64 \
 --tag=custom:15 \
 --file=images/layered/Containerfile .
```

## Build args

| Arg                  | Purpose                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Frappe Framework** |                                                                                               |
| FRAPPE_PATH          | Repository URL for Frappe framework source code. Defaults to https://github.com/frappe/frappe |
| FRAPPE_BRANCH        | Branch to use for Frappe framework. Defaults to version-15                                    |
| **Custom Apps**      |                                                                                               |
| APPS_JSON_BASE64     | Base64-encoded JSON string from apps.json defining apps to install                            |
| **Dependencies**     |                                                                                               |
| PYTHON_VERSION       | Python version for the base image                                                             |
| NODE_VERSION         | Node.js version                                                                               |
| WKHTMLTOPDF_VERSION  | wkhtmltopdf version                                                                           |
| **bench only**       |                                                                                               |
| DEBIAN_BASE          | Debian base version for the bench image, defaults to `bookworm`                               |
| WKHTMLTOPDF_DISTRO   | use the specified distro for debian package. Default is `bookworm`                            |

# env file

The compose file requires several environment variables. You can either export them on your system or create a `.env` file.

```bash
cp example.env custom.env
```

Edit `custom.env` to customize variables for your setup. The template includes common variables, but you can add, modify, or remove any as needed. See [env-variables.md](env-variables.md) for detailed descriptions of all available variables.

# Creating the final compose file

Combine the base compose file with appropriate overrides for your use case. This example adds MariaDB, Redis, and exposes ports on `:8080`:

```bash
docker compose --env-file example.env \
    -f compose.yaml \
    -f overrides/compose.mariadb.yaml \
    -f overrides/compose.redis.yaml \
    -f overrides/compose.noproxy.yaml \
    config > compose.custom.yaml
```

This generates `compose.custom.yaml`, which you'll use to start all containers. Customize the overrides and environment variables according to your requirements.

> **NOTE**: podman compose is just a wrapper, it uses docker-compose if it is available or podman-compose if not. podman-compose have an issue reading .env files ([Issue](https://github.com/containers/podman-compose/issues/475)) and might create an issue when running the containers.

---

**Next:** [Start Setup →](03-start-setup.md)

**Back:** [Container Overview ←](01-overview.md)
