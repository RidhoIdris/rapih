process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://rapih:rapih@localhost:5433/rapih_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/15';
process.env.TZ ??= 'Asia/Jakarta';
process.env.LOG_LEVEL ??= 'silent';
process.env.PORT ??= '3099';
