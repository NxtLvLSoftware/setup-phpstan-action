# Action nxtlvlsoftware/setup-phpstan

GitHub action for installing PHPStan in actions workflows.

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
Build (or attempt to download) any PHP release by providing the version:

```yml
name: My PHP Workflow
on: [push]
jobs:
  setup-php:
    name: Setup PHPStan
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: nxtlvlsoftware/setup-phpstan@v1
        with:
          version: 1.4.10
      - run: |
        echo "phpstan version 1.4.10 installed to ${{ outputs.phpstan }}"
```

Or provide the path to an existing PHPStan installation/binary:
```yml
name: My PHP Workflow
on: [push]
jobs:
  setup-php:
    name: Setup PHP
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: nxtlvlsoftware/setup-phpstan@v1
        with:
          path: 'path/to/your/phpstan.phar'
      - run: |
        echo "existing phpstan installation from ${{ outputs.phpstan }} added to path"
```
