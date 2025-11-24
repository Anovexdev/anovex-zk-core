import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-minimum-32-chars-required';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.SESSION_SECRET = 'test-session-secret';
  console.log('Test setup initialized');
});

afterAll(() => {
  console.log('Test cleanup completed');
});
