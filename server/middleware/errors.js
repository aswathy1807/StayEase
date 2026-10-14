function notFound(req, res) {
  res.status(404).json({ error: 'API route not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'ZodError') {
    return res.status(400).json({ error: error.issues.map((issue) => issue.message).join(', ') });
  }
  if (['MongooseServerSelectionError', 'MongoNetworkError', 'MongoTimeoutError', 'MongoTopologyClosedError'].includes(error.name)
      || /buffering timed out/i.test(error.message || '')) {
    const safeMessage = String(error.message || '').replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]');
    console.error('MongoDB connection failure:', error.name, safeMessage);
    return res.status(503).json({
      error: 'Database connection unavailable. Check the Vercel MONGODB_URI setting and MongoDB Atlas network access.'
    });
  }
  if (error.code === 11000) return res.status(409).json({ error: 'A record with this value already exists' });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: status >= 500 ? 'An unexpected server error occurred' : error.message });
}

module.exports = { notFound, errorHandler };
