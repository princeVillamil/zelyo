#!/bin/sh
NODE_OPTIONS=--conditions=react-server
export NODE_OPTIONS
exec ./node_modules/.bin/tsx prisma/seed.ts
