#!/bin/bash
rm -rf dist
pnpm i
cd src/background
tsc
cd ../popup
pnpm i
npm run build
