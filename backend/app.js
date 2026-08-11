const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const toolRoutes = require('./routes/tool.routes');
const conversationRoutes = require('./routes/conversation.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const promptRoutes = require('./routes/prompt.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LLBox AI Backend is healthy',
    data: {
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      dummyMode: String(process.env.LLBOX_DUMMY_MODE || 'true').toLowerCase() !== 'false',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
