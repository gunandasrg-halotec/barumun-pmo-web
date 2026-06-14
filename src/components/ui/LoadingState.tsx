interface Props {
  message?: string;
}

export default function LoadingState({ message = 'Memuat data...' }: Props) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
