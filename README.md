# Electron-Based Core System

Init script of VentrOS to run apps and services that utilize HTML5 technology. This core system will take a look for available launcher and run it. Thus, we don't need multiple instance of separated electron browser processes in a single computer.

## Requires

- [NodeJS](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/getting-started)

## How to get the source code

```sh
git clone https://github.com/ventros-project/core-electron.git
cd core-electron
yarn install
```

## How to run

```sh
yarn run start
```
