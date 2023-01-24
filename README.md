# Action nxtlvlsoftware/setup-phpstan-action

GitHub action for installing [PHPStan](https://github.com/phpstan/phpstan) in actions workflows.

- [x] Allows passing version string and installing from github releases into path/env.
- [x] Allows passing existing executable path and installing into path/env.
- [x] Supports caching for version string and existing binary installations.

| Action Input | Required | Default | Description                                                                            |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------- |
| install-path | true     |          | The path to install PHPStan binary to.                                                |
| version      | false    | latest   | The target PHPStan version to install. Exact versions only (8.0.11, 7.4.24, etc.)     |
| path         | false    | false    | Path to an existing PHPStan installation.                                             |

Either `version` or `path` must be specified.

## How to use
Attempt to download any PHPStan release by providing the version:

```yml
name: My PHPStan Workflow
on: [push]
jobs:
  setup-phpstan:
    name: Setup PHPStan
    runs-on: ubuntu-latest
    steps:
      - uses: nxtlvlsoftware/setup-phpstan-action@v1
        with:
          version: '1.8.2'
          install-path: './bin'
```

Or provide the path to an existing PHPStan installation/binary:
```yml
name: My PHPStan Workflow
on: [push]
jobs:
  setup-phpstan:
    name: Setup PHPStan
    runs-on: ubuntu-latest
    steps:
      - uses: nxtlvlsoftware/setup-phpstan-action@v1
        with:
          path: 'path/to/your/phpstan.phar'
          install-path: './bin'
```

## License
`nxtlvlsoftware/tar-ops-action` is open-sourced software licensed under the [MIT license](LICENSE).
