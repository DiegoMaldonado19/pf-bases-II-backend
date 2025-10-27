import { createClient, RedisClientType } from 'redis';

class RedisConfig {
  private client: RedisClientType | null = null;

  async connect(): Promise<void> {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');

    this.client = createClient({
      socket: {
        host,
        port
      }
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => console.log('Redis connected successfully'));

    await this.client.connect();
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis not initialized');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      console.log('Redis disconnected');
    }
  }
}

export const redisConfig = new RedisConfig();