-- B0.1: extensions for scheduled jobs (pg_cron) and HTTP calls from SQL (pg_net).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
