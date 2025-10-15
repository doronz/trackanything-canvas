import Link from 'next/link';

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '1rem',
        }}
      >
        {statusCode || 'Error'}
      </h1>
      <p
        style={{
          color: '#6b7280',
          marginBottom: '2rem',
        }}
      >
        {statusCode ? `An error ${statusCode} occurred` : 'An error occurred'}
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          borderRadius: '0.5rem',
          textDecoration: 'none',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
