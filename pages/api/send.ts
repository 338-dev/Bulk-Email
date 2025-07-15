
import type { NextApiRequest, NextApiResponse } from 'next';
import { processQueue } from '../../lib/queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const result = await processQueue();
      if (result.success) {
        // 202 Accepted: The request has been accepted for processing, but is not complete.
        res.status(202).json({ message: result.message });
      } else {
        // 409 Conflict: The request could not be processed because of a conflict in the current state.
        res.status(409).json({ message: result.message });
      }
    } catch (error) {
      res.status(500).json({ message: 'An internal server error occurred.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
