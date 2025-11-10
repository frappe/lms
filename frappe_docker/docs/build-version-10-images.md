Clone the version-10 branch of this repo

```shell
git clone https://github.com/frappe/frappe_docker.git -b version-10 && cd frappe_docker
```

Build the images

```shell
export DOCKER_REGISTRY_PREFIX=frappe
docker build -t ${DOCKER_REGISTRY_PREFIX}/frappe-socketio:v10 -f build/frappe-socketio/Dockerfile .
docker build -t ${DOCKER_REGISTRY_PREFIX}/frappe-nginx:v10 -f build/frappe-nginx/Dockerfile .
docker build -t ${DOCKER_REGISTRY_PREFIX}/erpnext-nginx:v10 -f build/erpnext-nginx/Dockerfile .
docker build -t ${DOCKER_REGISTRY_PREFIX}/frappe-worker:v10 -f build/frappe-worker/Dockerfile .
docker build -t ${DOCKER_REGISTRY_PREFIX}/erpnext-worker:v10 -f build/erpnext-worker/Dockerfile .
```
