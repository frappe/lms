WARNING: Do not use this in production if the site is going to be served over plain http.

### Step 1

Remove the traefik service from docker-compose.yml

### Step 2

Add service for each port that needs to be exposed.

e.g. `port-site-1`, `port-site-2`, `port-site-3`.

```yaml
# ... removed for brevity
services:
	# ... removed for brevity
  port-site-1:
    image: frappe/erpnext:v14.11.1
    deploy:
      restart_policy:
        condition: on-failure
    command:
      - nginx-entrypoint.sh
    environment:
      BACKEND: backend:8000
      FRAPPE_SITE_NAME_HEADER: site1.local
      SOCKETIO: websocket:9000
    volumes:
      - sites:/home/frappe/frappe-bench/sites
    ports:
      - "8080:8080"
  port-site-2:
    image: frappe/erpnext:v14.11.1
    deploy:
      restart_policy:
        condition: on-failure
    command:
      - nginx-entrypoint.sh
    environment:
      BACKEND: backend:8000
      FRAPPE_SITE_NAME_HEADER: site2.local
      SOCKETIO: websocket:9000
    volumes:
      - sites:/home/frappe/frappe-bench/sites
    ports:
      - "8081:8080"
  port-site-3:
    image: frappe/erpnext:v14.11.1
    deploy:
      restart_policy:
        condition: on-failure
    command:
      - nginx-entrypoint.sh
    environment:
      BACKEND: backend:8000
      FRAPPE_SITE_NAME_HEADER: site3.local
      SOCKETIO: websocket:9000
    volumes:
      - sites:/home/frappe/frappe-bench/sites
    ports:
      - "8082:8080"
```

Notes:

- Above setup will expose `site1.local`, `site2.local`, `site3.local` on port `8080`, `8081`, `8082` respectively.
- Change `site1.local` to site name to serve from bench.
- Change the `BACKEND` and `SOCKETIO` environment variables as per your service names.
- Make sure `sites:` volume is available as part of yaml.
