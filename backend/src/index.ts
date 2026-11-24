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

const app = express();

app.use(cors({ origin: true, credentials: true }));
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

  app.use('/admin/queues', serverAdapter.getRouter());
  console.log('📊 BullMQ Live Queue Dashboard mounted at /admin/queues');
} catch (err) {
  console.warn('BullBoard setup note:', err);
}

// API Routes
app.use('/api', apiRouter);

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
