
import type { NextApiRequest, NextApiResponse } from 'next';
import { addRecipients } from '../../lib/queue';
import { Recipient } from '../../types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const newRecipients: Omit<Recipient, 'id'>[] = req.body;
      
      if (!Array.isArray(newRecipients)) {
        return res.status(400).json({ message: 'Request body must be a valid JSON array.' });
      }

      const result = addRecipients(newRecipients);
      if (result.success) {
        res.status(201).json({ success: true, message: 'Recipients added to the queue.' });
      } else {
        // This case is currently not hit but is good practice
        res.status(400).json({ success: false, message: 'Failed to add recipients.' });
      }
    } catch (error) {
      res.status(500).json({ message: 'An internal server error occurred.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
