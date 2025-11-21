import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  console.log('Test setup initialized');
});

afterAll(() => {
  console.log('Test cleanup completed');
});
