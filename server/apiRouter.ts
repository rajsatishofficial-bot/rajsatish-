import express, { Request, Response } from 'express';
import { processChatQuery } from './geminiService.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json());

apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, role, mapContext, useSearch } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const result = await processChatQuery({
      messages,
      role: role || 'guide',
      mapContext,
      useSearch: useSearch !== false,
    });

    return res.json(result);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: (error as Error).message || 'Failed to process chat query',
    });
  }
});

apiRouter.get('/config', (_req: Request, res: Response) => {
  const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  res.json({
    hasMapsKey: Boolean(mapsKey),
    mapsApiKey: mapsKey,
  });
});
