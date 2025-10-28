import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import indexRoutes from './routes/index.routes';
import searchRoutes from './routes/search.routes';
import suggestRoutes from './routes/suggest.routes';
import uploadRoutes from './routes/upload.routes';
import { Logger } from './utils/logger.util';

dotenv.config();

class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private setupMiddlewares(): void {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      Logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      });
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('/api/index', indexRoutes);
    this.app.use('/api/search', searchRoutes);
    this.app.use('/api/suggest', suggestRoutes);
    this.app.use('/api/upload', uploadRoutes);

    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found'
      });
    });
  }

  private setupErrorHandlers(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      Logger.error('Unhandled error', err);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : err.message
      });
    });
  }

  private async connectDatabases(): Promise<void> {
    try {
      await databaseConfig.connect();
      await redisConfig.connect();
      Logger.info('All databases connected successfully');
    } catch (error) {
      Logger.error('Database connection failed', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      Logger.info(`${signal} received, shutting down gracefully...`);
      
      try {
        await databaseConfig.disconnect();
        await redisConfig.disconnect();
        Logger.info('Databases disconnected');
        process.exit(0);
      } catch (error) {
        Logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async start(): Promise<void> {
    try {
      await this.connectDatabases();
      
      this.app.listen(this.port, () => {
        Logger.info(`Server running on port ${this.port}`);
        Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      this.setupGracefulShutdown();
    } catch (error) {
      Logger.error('Failed to start server', error);
      process.exit(1);
    }
  }
}

const server = new Server();
server.start();