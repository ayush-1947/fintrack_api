-- docker/postgres/init.sql
-- Run once on first container start.
-- Migrations are handled by Prisma, not here.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for ILIKE text search performance

-- Create test DB for CI
SELECT 'CREATE DATABASE fintrack_test OWNER fintrack'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fintrack_test')\gexec
