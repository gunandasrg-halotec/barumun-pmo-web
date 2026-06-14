import Modal from './Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'btn-danger' | 'btn-success' | 'btn-primary';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Konfirmasi', confirmVariant = 'btn-primary', isLoading,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </button>
          <button
            className={`btn ${confirmVariant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner-sm spinner" /> : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
