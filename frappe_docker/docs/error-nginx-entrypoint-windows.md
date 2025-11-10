# Resolving Docker `nginx-entrypoint.sh` Script Not Found Error on Windows

If you're encountering the error `exec /usr/local/bin/nginx-entrypoint.sh: no such file or directory` in a Docker container on Windows, follow these steps to resolve the issue.

## 1. Check Line Endings

On Windows, files often have `CRLF` line endings, while Linux systems expect `LF`. This can cause issues when executing shell scripts in Linux containers.

- **Convert Line Endings using `dos2unix`:**
  ```bash
  dos2unix resources/nginx-entrypoint.sh
  ```
