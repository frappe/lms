# Accessing ERPNext through https on local deployment

- ERPNext container deployment can be accessed through https easily using Caddy web server, Caddy will be used as reverse proxy and forward traffics to the frontend container.

### Prerequisites

- Caddy
- Adding a domain name to hosts file

#### Installation of caddy webserver

- Follow the official Caddy website for the installation guide https://caddyserver.com/docs/install
  After completing the installation open the configuration file of Caddy ( You find the config file in ` /etc/caddy/Caddyfile`), add the following configuration to forward traffics to the ERPNext frontend container

```js
erp.localdev.net {
  tls internal

  reverse_proxy localhost:8085 {

  }
}
```

- Caddy's root certificate must be added to other computers if computers from different networks access the ERPNext through https.
