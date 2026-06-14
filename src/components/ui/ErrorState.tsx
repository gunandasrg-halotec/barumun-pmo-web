interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Gagal memuat data', onRetry }: Props) {
  return (
    <div className="error-state">
      <strong>⚠️ Error:</strong> {message}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }}>
          Coba Lagi
        </button>
      )}
    </div>
  );
}
