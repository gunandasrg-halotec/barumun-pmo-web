import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import WbdTree from './WbdTree';
import WbdVersionList from './WbdVersionList';
import WbdNodeForm from './WbdNodeForm';
import { formatCurrency, extractError } from '../../utils/format';
import type { WbdNode, WbdVersion } from '../../types';

export default function WbdPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canManageWbd, canApproveWbd } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]           = useState<'tree' | 'versions'>('tree');
  const [selectedVersion, setSelectedVersion] = useState<WbdVersion | null>(null);
  const [showAddNode, setShowAddNode]       = useState(false);
  const [parentNode, setParentNode]         = useState<WbdNode | null>(null);
  const [rejectModal, setRejectModal]       = useState<string | null>(null);
  const [rejectReason, setRejectReason]     = useState('');

  const projectQ  = useQuery({ queryKey: ['project', projectId],        queryFn: () => projectService.get(projectId!) });
  const versionsQ = useQuery({ queryKey: ['wbd-versions', projectId],   queryFn: () => wbdService.listVersions(projectId!), enabled: !!projectId });
  const nodesQ    = useQuery({ queryKey: ['wbd-nodes', selectedVersion?.id], queryFn: () => wbdService.getNodes(selectedVersion!.id), enabled: !!selectedVersion?.id });

  const createVersionMut = useMutation({
    mutationFn: (basedOn?: string) => wbdService.createVersion(projectId!, basedOn),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] });
      setSelectedVersion(res.data);
      setActiveTab('tree');
    },
  });
  const submitMut  = useMutation({ mutationFn: (id: string) => wbdService.submitVersion(id),  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] }) });
  const approveMut = useMutation({ mutationFn: (id: string) => wbdService.approveVersion(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] }); queryClient.invalidateQueries({ queryKey: ['project', projectId] }); } });
  const rejectMut  = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => wbdService.rejectVersion(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbd-versions', projectId] }); setRejectModal(null); setRejectReason(''); },
  });

  const project = (projectQ.data as any)?.data;
  const versions: WbdVersion[] = (versionsQ.data as any)?.data ?? [];
  const activeVersion = versions.find(v => v.is_active) ?? null;

  if (!selectedVersion && versions.length > 0) {
    setSelectedVersion(activeVersion ?? versions[0]);
  }

  const isDraft   = selectedVersion?.status === 'DRAFT';
  const isPending = selectedVersion?.status === 'PENDING_DIRECTOR_APPROVAL';

  const nodes: any[] = (nodesQ.data as any)?.data ?? [];
  const totalCost = nodes.filter((n: any) => n.node_type === 'GROUP').reduce((s: number, n: any) => s + (n.total_cost ?? 0), 0);
  const itemCount = nodes.filter((n: any) => n.node_type === 'ITEM').length;

  return (
    <div>
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>WBD Pekerjaan</h3>
            <p>Editor WBD hierarkis dengan perhitungan otomatis biaya, % komponen, % total, dan tanggal akhir.</p>
          </div>
          <div className="cluster">
            <span className="chip status-ok">Auto hitung aktif</span>
            {canManageWbd() && (
              <button className="btn" onClick={() => createVersionMut.mutate(activeVersion?.id)} disabled={createVersionMut.isPending}>
                + Draft Versi Baru
              </button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        <div className="summary-bar">
          <div className="summary-item"><span>Total Biaya</span><strong>{formatCurrency(totalCost)}</strong></div>
          <div className="summary-item"><span>Total Item</span><strong>{itemCount}</strong></div>
          <div className="summary-item"><span>Versi WBD</span><strong>{versions.length}</strong></div>
          <div className="summary-item"><span>Status</span><strong>{selectedVersion ? <span className={`badge ${isDraft ? 'planned' : isPending ? 'delay' : 'done'}`}>{selectedVersion.status}</span> : '—'}</strong></div>
        </div>

        {/* Tab switcher */}
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button className={`btn ${activeTab === 'tree' ? '' : 'secondary'}`} onClick={() => setActiveTab('tree')}>Struktur WBD</button>
          <button className={`btn ${activeTab === 'versions' ? '' : 'secondary'}`} onClick={() => setActiveTab('versions')}>Riwayat Versi</button>
          <div className="stretch" />
          {activeTab === 'tree' && versions.length > 0 && (
            <select value={selectedVersion?.id ?? ''} onChange={e => { const v = versions.find(v => v.id === e.target.value); setSelectedVersion(v ?? null); }}>
              {versions.map(v => (
                <option key={v.id} value={v.id}>Version {v.version_number} — {v.status}{v.is_active ? ' ✓ Aktif' : ''}</option>
              ))}
            </select>
          )}
          {canManageWbd() && isDraft && selectedVersion && (
            <>
              <button className="btn secondary" onClick={() => { setParentNode(null); setShowAddNode(true); }}>+ Tambah Item</button>
              <button className="btn" onClick={() => submitMut.mutate(selectedVersion.id)} disabled={submitMut.isPending}>Ajukan ke Direksi</button>
            </>
          )}
          {canApproveWbd() && isPending && selectedVersion && (
            <>
              <button className="btn" onClick={() => approveMut.mutate(selectedVersion.id)} disabled={approveMut.isPending}>✓ Setujui</button>
              <button className="btn danger" onClick={() => setRejectModal(selectedVersion.id)}>✕ Tolak</button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'versions' ? (
        <WbdVersionList
          versions={versions}
          isLoading={versionsQ.isLoading}
          selectedVersionId={selectedVersion?.id}
          onSelect={v => { setSelectedVersion(v); setActiveTab('tree'); }}
          onSubmit={id => submitMut.mutate(id)}
          onApprove={id => approveMut.mutate(id)}
          onReject={id => setRejectModal(id)}
          canManage={canManageWbd()}
          canApprove={canApproveWbd()}
        />
      ) : nodesQ.isLoading ? (
        <div className="loading-state">Memuat struktur WBD...</div>
      ) : nodesQ.error ? (
        <div className="danger-box">{extractError(nodesQ.error)}</div>
      ) : selectedVersion ? (
        <WbdTree
          nodes={nodes}
          isEditable={isDraft && canManageWbd()}
          versionId={selectedVersion.id}
          onAddChild={parent => { setParentNode(parent); setShowAddNode(true); }}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['wbd-nodes', selectedVersion?.id] })}
        />
      ) : (
        <div className="empty-state">
          Pilih versi WBD atau buat versi baru untuk mulai.
          {canManageWbd() && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => createVersionMut.mutate()}>+ Buat WBD Pertama</button>
            </div>
          )}
        </div>
      )}

      {/* Add Node Modal */}
      {showAddNode && selectedVersion && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddNode(false); }}>
          <div className="modal-window">
            <div className="modal-head">
              <div>
                <h4>{parentNode ? `Tambah Item — ${parentNode.name}` : 'Tambah Item WBD'}</h4>
                <p>Isi detail item pekerjaan. Total biaya dan tanggal akhir dihitung otomatis.</p>
              </div>
              <button className="modal-close" onClick={() => setShowAddNode(false)}>×</button>
            </div>
            <div className="modal-body">
              <WbdNodeForm
                versionId={selectedVersion.id}
                parentNode={parentNode}
                onSuccess={() => { setShowAddNode(false); queryClient.invalidateQueries({ queryKey: ['wbd-nodes', selectedVersion.id] }); }}
                onCancel={() => setShowAddNode(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="modal-window" style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <div>
                <h4>Tolak WBD Version</h4>
                <p>Berikan alasan penolakan yang jelas agar tim dapat merevisi.</p>
              </div>
              <button className="modal-close" onClick={() => setRejectModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Alasan Penolakan *</label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Jelaskan alasan penolakan WBD ini..."
                  style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', font: 'inherit', fontSize: 13 }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <div />
              <div className="cluster">
                <button className="btn secondary" onClick={() => setRejectModal(null)}>Batal</button>
                <button className="btn danger" disabled={!rejectReason.trim() || rejectMut.isPending} onClick={() => rejectMut.mutate({ id: rejectModal, reason: rejectReason })}>Tolak WBD</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
