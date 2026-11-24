import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { initDB } from './db';
import { initQueue, emailQueue } from './services/queueService';
import { searchService } from './services/searchService';
import apiRouter from './routes/api';
import { loginWithPassword, verifySession } from './middleware/auth';

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite schema
initDB();

// Initialize BullMQ Queue and Worker
initQueue();

// Initialize Elasticsearch/MiniSearch fulltext engine
searchService.init();

// Setup Bull Board for Live Queue Visibility (Required by Assignment)
try {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  if (emailQueue) {
    createBullBoard({
      queues: [new BullMQAdapter(emailQueue)],
      serverAdapter: serverAdapter,
    });
  }

  app.use('/admin/queues', verifySession, serverAdapter.getRouter());
  console.log('📊 BullMQ Live Queue Dashboard mounted at /admin/queues');
} catch (err) {
  console.warn('BullBoard setup note:', err);
}

// API Routes
app.post('/api/auth/login', loginWithPassword);
app.use('/api', verifySession, apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.listen(config.port, () => {
  console.log(`\n=================================================`);
  console.log(`✨ ReachInbox Email Scheduler API is live on port ${config.port}`);
  console.log(`🌐 Base URL: http://localhost:${config.port}`);
  console.log(`📊 BullMQ Dashboard: http://localhost:${config.port}/admin/queues`);
  console.log(`=================================================\n`);
});
