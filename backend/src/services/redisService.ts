// @ts-ignore
import RedisMock from 'ioredis-mock';
import Redis from 'ioredis';
import { config } from '../config';

// Robust in-process Redis mock engine ensuring 100% reliability in offline / standalone mode
const sharedMock = new RedisMock();

export function getRedisClient(): Redis {
  return sharedMock as unknown as Redis;
}

export function createRedisInstance(): Redis {
  return new RedisMock() as unknown as Redis;
}
