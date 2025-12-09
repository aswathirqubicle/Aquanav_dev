import express from "express";
import { assetRoutes } from "./asset-routes";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from the client build directory (if exists)
app.use(express.static('dist'));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Asset inventory server running' });
});

// Asset inventory routes
app.use(assetRoutes);

// Fallback route for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ message: 'API endpoint not found' });
  } else {
    // In production, this would serve index.html
    res.json({ message: 'Frontend not built. Access asset inventory at /asset-inventory' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Asset inventory server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET /api/health - Server health check`);
  console.log(`  GET /api/asset-types - List all asset types`);
  console.log(`  GET /api/asset-instances - List all asset instances`);
  console.log(`  GET /api/asset-summary - Asset summary statistics`);
  console.log(`  GET /api/maintenance/upcoming - Upcoming maintenance`);
});

export default app;