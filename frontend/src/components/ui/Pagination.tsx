interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="btn btn-sm btn-secondary"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        ← Prev
      </button>
      <span>
        Halaman {page} dari {totalPages} ({total} data)
      </span>
      <button
        className="btn btn-sm btn-secondary"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next →
      </button>
    </div>
  );
}
