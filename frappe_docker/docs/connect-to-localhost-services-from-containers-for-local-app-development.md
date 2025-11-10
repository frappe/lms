Add following to frappe container from the `.devcontainer/docker-compose.yml`:

```yaml
...
  frappe:
    ...
    extra_hosts:
      app1.localhost: 172.17.0.1
      app2.localhost: 172.17.0.1
...
```

This is makes the domain names `app1.localhost` and `app2.localhost` connect to docker host and connect to services running on `localhost`.
