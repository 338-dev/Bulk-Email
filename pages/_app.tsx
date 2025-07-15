
import type { AppProps } from 'next/app';
import '../styles/globals.css';

// This is the root of your Next.js application.
// It allows for initializing pages and applying global styles.
function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
