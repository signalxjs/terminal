#!/usr/bin/env node
// Thin bin shim: the real CLI is built to dist/cli.js. Kept as a committed
// wrapper so the shebang doesn't depend on build banners.
import '../dist/cli.js';
