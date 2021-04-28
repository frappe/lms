# Mockups

HTML Mockups using [Mockdown][].

[Mockdown]: https://github.com/anandology/mockdown

## How to use

**Step 1:** Get into `mockups` directory

```
$ cd mockups
```

**Step 2:** Instal `mockdown`

```
$ pip install mockdown
```

**Step 3:** Start mockdown server

```
$ mockdown
...
 * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)
...
```

**Step 4:** See the mockups at <http://localhost:5000/>.

## How does it work?

Mockdown uses [Jinja][] templates for writing HTML.

[Jinja]: https://jinja.palletsprojects.com/

To make is easy to provide test data, Mockdown looks for YAML file with the same name as the template. For example, `home.html` template uses the data from `home.yml`.

