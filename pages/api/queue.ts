
import type { NextApiRequest, NextApiResponse } from 'next';
import { getQueueState } from '../../lib/queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const state = await getQueueState();
      res.status(200).json(state);
    } catch (error) {
      res.status(500).json({ message: 'An internal server error occurred.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
