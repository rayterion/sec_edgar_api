# Ecosystem review

Checked 2026-09-24. [EdgarTools](https://github.com/dgunning/edgartools) is a mature Python library for direct SEC retrieval and rich filing parsing. This package targets Node ESM with a small JSON API, exact-value lineage, and explicit partial results. It does not claim EdgarTools' filing-type breadth. [sec-api.io](https://sec-api.io/) offers a hosted commercial API; this package has no hosted dependency or key. Community discussions repeatedly ask for normalized statement history and direct filing context; those are design signals, not evidence of SEC endpoint behavior. Endpoint claims here are verified against [SEC documentation](sources.md).

Potential commercial services around the open MIT core include specialist filing parsers, enterprise data-quality checks, and support. Public SEC access remains free and direct for library users.
