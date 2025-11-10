Add the following configuration to `launch.json` `configurations` array to start bench console and use debugger. Replace `development.localhost` with appropriate site. Also replace `frappe-bench` with name of the bench directory.

```json
{
  "name": "Bench Console",
  "type": "python",
  "request": "launch",
  "program": "${workspaceFolder}/frappe-bench/apps/frappe/frappe/utils/bench_helper.py",
  "args": ["frappe", "--site", "development.localhost", "console"],
  "pythonPath": "${workspaceFolder}/frappe-bench/env/bin/python",
  "cwd": "${workspaceFolder}/frappe-bench/sites",
  "env": {
    "DEV_SERVER": "1"
  }
}
```
