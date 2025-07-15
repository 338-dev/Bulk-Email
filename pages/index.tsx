
import type { NextPage } from 'next';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Recipient, SendStatus, StatusMap } from '../types';
import Header from '../components/Header';
import RecipientForm from '../components/RecipientForm';
import RecipientList from '../components/RecipientList';
import XCircleIcon from '../components/icons/XCircleIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';

const HomePage: NextPage = () => {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [notification, setNotification] = useState<string>('');

  const poller = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;

  const handleError = useCallback((message: string) => {
    setError(message);
    if (message) {
      setTimeout(() => setError(''), 5000); // Auto-hide error after 5 seconds
    }
  }, []);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 5000); // Auto-hide notification after 5 seconds
  };

  const getQueueState = useCallback(async () => {
    try {
      const response = await fetch('/api/queue');
      if (!response.ok) throw new Error('Failed to fetch queue state');
      
      const state = await response.json();
      setRecipients(state.recipients);
      setStatuses(state.statuses);
      setIsSending(state.isSending);

      // If polling detects the sending process has finished
      if (isSendingRef.current && !state.isSending) {
        if (poller.current) clearInterval(poller.current);
        poller.current = null;
        
        const failedCount = state.recipients.filter((r: any) => state.statuses[r.id] === SendStatus.FAILED).length;
        if (failedCount > 0) {
            showNotification(`Sending process completed. ${failedCount} email(s) failed and remain in queue.`);
        } else {
            showNotification('All emails were sent successfully!');
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to sync with the server.';
      handleError(message);
      if (poller.current) clearInterval(poller.current);
    }
  }, [handleError]);

  // Effect for polling the backend for status updates
  useEffect(() => {
    if (isSending) {
      if (!poller.current) {
        poller.current = setInterval(getQueueState, 1000); // Poll every second
      }
    } else {
      if (poller.current) {
        clearInterval(poller.current);
        poller.current = null;
      }
    }
    return () => {
      if (poller.current) clearInterval(poller.current);
    };
  }, [isSending, getQueueState]);

  // Effect for initial data load
  useEffect(() => {
    getQueueState();
  }, [getQueueState]);

  const handleAddRecipients = useCallback(async (newRecipients: Omit<Recipient, 'id'>[]) => {
    try {
      const response = await fetch('/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecipients),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to add recipients');
      }
      await getQueueState();
      showNotification(`${newRecipients.length} recipient(s) added to the queue.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      handleError(message);
    }
  }, [getQueueState, handleError]);

  const handleSendMails = async () => {
    if (isSending || recipients.length === 0) return;

    try {
      const response = await fetch('/api/send', { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to start sending process.');
      }
      
      // The API returns 202 Accepted, we start polling
      setIsSending(true);
      showNotification('Sending process has been initiated...');

    } catch (e) {
      const message = e instanceof Error ? e.message : 'An error occurred.';
      handleError(message);
    }
  };

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Header />

        <div className="h-14">
          {error && (
            <div className="flex items-center p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-slate-900 dark:text-red-400 border border-red-300 dark:border-red-600" role="alert">
              <XCircleIcon className="w-5 h-5 mr-3" />
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
          {notification && !error && (
            <div className="flex items-center p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-slate-900 dark:text-green-400 border border-green-300 dark:border-green-600" role="alert">
              <CheckCircleIcon className="w-5 h-5 mr-3" />
              <span className="font-medium">Success:</span> {notification}
            </div>
          )}
        </div>

        <RecipientForm onAddRecipients={handleAddRecipients} onError={handleError} />
        <RecipientList
          recipients={recipients}
          onSend={handleSendMails}
          isSending={isSending}
          statuses={statuses}
        />
        <footer className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
          <p>Built with a Next.js backend and React frontend.</p>
          <p>&copy; {new Date().getFullYear()} Bulk Email Sender. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
