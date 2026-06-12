import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import WbdTree from './WbdTree';
import WbdVersionList from './WbdVersionList';
import WbdNodeForm from './WbdNodeForm';
import { formatCurrency, extractError } from '../../utils/format';
import type { WbdNode, WbdVersion } from '../../types';

export default function WbdPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canManageWbd, canApproveWbd } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tree' | 'versions'>('tree');
  const [selectedVersion, setSelectedVersion] = useState<WbdVersion | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [parentNode, setParentNode] = useState<WbdNode | null>(null);
  const [rejectModal, setRejectModal] = useState<{ versionId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const projectQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.get(projectId!),
  });

  const versionsQ = useQuery({
    queryKey: ['wbd-versions', projectId],
    queryFn: () => wbdService.listVersions(projectId!),
    enabled: !!projectId,
  });

  const nodesQ = useQuery({
    queryKey: ['wbd-nodes', selectedVersion?.id],
    queryFn: () => wbdService.getNodes(selectedVersion!.id),
    enabled: !!selectedVersion?.id,
  });

  const createVersionMut = useMutation({
    mutationFn: (basedOn?: string) => wbdService.createVersion(projectId!, basedOn),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] });
      setSelectedVersion(res.data);
      setActiveTab('tree');
    },
  });

  const submitMut = useMutation({
    mutationFn: (versionId: string) => wbdService.submitVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] });
    },
  });

  const approveMut = useMutation({
    mutationFn: (versionId: string) => wbdService.approveVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      wbdService.rejectVersion(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  const project = projectQ.data?.data;
  const versions = versionsQ.data?.data ?? [];
  const activeVersion = versions.find((v) => v.is_active) ?? null;

  if (!selectedVersion && versions.length > 0) {
    const toSelect = activeVersion ?? versions[0];
    setSelectedVersion(toSelect);
  }

  const isDraftVersion = selectedVersion?.status === 'DRAFT';
  const isPendingVersion = selectedVersion?.status === 'PENDING_DIRECTOR_APPROVAL';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>WBD — {project?.project_name}</h1>
            <p>Work Breakdown Detail & Versioning</p>
          </div>
          <div className="btn-group">
            {canManageWbd() && (
              <button
                className="btn btn-primary"
                onClick={() => createVersionMut.mutate(activeVersion?.id)}
                disabled={createVersionMut.isPending}
              >
                + Draft Versi Baru
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-row" style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['tree', 'versions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
              fontSize: 13,
            }}
          >
            {tab === 'tree' ? '🗂️ Struktur WBD' : '📚 Riwayat Versi'}
          </button>
        ))}
      </div>

      {activeTab === 'versions' ? (
        <WbdVersionList
          versions={versions}
          isLoading={versionsQ.isLoading}
          selectedVersionId={selectedVersion?.id}
          onSelect={(v) => { setSelectedVersion(v); setActiveTab('tree'); }}
          onSubmit={(id) => submitMut.mutate(id)}
          onApprove={(id) => approveMut.mutate(id)}
          onReject={(id) => setRejectModal({ versionId: id })}
          canManage={canManageWbd()}
          canApprove={canApproveWbd()}
        />
      ) : (
        <div className="card">
          {/* Version selector header */}
          <div className="card-header">
            <div className="flex-row">
              <div>
                {selectedVersion ? (
                  <>
                    <span style={{ fontWeight: 600 }}>
                      Version {selectedVersion.version_number}
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      <StatusBadge status={selectedVersion.status} />
                    </span>
                    {selectedVersion.is_active && (
                      <span className="badge badge-success" style={{ marginLeft: 4 }}>
                        ✓ Baseline Aktif
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted">Belum ada versi WBD</span>
                )}
              </div>
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={selectedVersion?.id ?? ''}
                onChange={(e) => {
                  const v = versions.find((v) => v.id === e.target.value);
                  setSelectedVersion(v ?? null);
                }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version_number} — {v.status}
                    {v.is_active ? ' ✓ Aktif' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="btn-group">
              {canManageWbd() && isDraftVersion && selectedVersion && (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => { setParentNode(null); setShowAddNode(true); }}
                  >
                    + Tambah Item
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => submitMut.mutate(selectedVersion.id)}
                    disabled={submitMut.isPending}
                  >
                    Ajukan ke Direksi
                  </button>
                </>
              )}
              {canApproveWbd() && isPendingVersion && selectedVersion && (
                <>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => approveMut.mutate(selectedVersion.id)}
                    disabled={approveMut.isPending}
                  >
                    ✓ Setujui
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setRejectModal({ versionId: selectedVersion.id })}
                  >
                    ✕ Tolak
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {nodesQ.isLoading ? (
              <LoadingState />
            ) : nodesQ.error ? (
              <ErrorState message={extractError(nodesQ.error)} />
            ) : selectedVersion ? (
              <WbdTree
                nodes={nodesQ.data?.data ?? []}
                isEditable={isDraftVersion && canManageWbd()}
                versionId={selectedVersion.id}
                onAddChild={(parent) => {
                  setParentNode(parent);
                  setShowAddNode(true);
                }}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['wbd-nodes', selectedVersion?.id] })}
              />
            ) : (
              <div className="empty-state">
                <p>Pilih versi WBD atau buat versi baru untuk mulai.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      <Modal
        isOpen={showAddNode}
        onClose={() => setShowAddNode(false)}
        title={parentNode ? `Tambah Item di bawah: ${parentNode.name}` : 'Tambah Item WBD'}
        size="lg"
      >
        {selectedVersion && (
          <WbdNodeForm
            versionId={selectedVersion.id}
            parentNode={parentNode}
            onSuccess={() => {
              setShowAddNode(false);
              queryClient.invalidateQueries({ queryKey: ['wbd-nodes', selectedVersion.id] });
            }}
            onCancel={() => setShowAddNode(false)}
          />
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Tolak WBD Version"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>Batal</button>
            <button
              className="btn btn-danger"
              disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectModal && rejectMut.mutate({ id: rejectModal.versionId, reason: rejectReason })}
            >
              Tolak WBD
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Alasan Penolakan <span className="required">*</span></label>
          <textarea
            className="form-control"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan WBD ini..."
          />
        </div>
      </Modal>
    </div>
  );
}
