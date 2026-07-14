export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="auth-error" role="alert">
      {message}
      {onRetry && (
        <button type="button" className="error-retry" onClick={onRetry}>Retry</button>
      )}
    </div>
  )
}
