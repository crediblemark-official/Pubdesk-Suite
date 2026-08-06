import React from 'react';
import { useWorkflowContext } from '../../../contexts/WorkflowContext';
import { Badge, getStatusVariant } from '../../../ui/atoms/Badge';
import { Button } from '../../../ui/atoms/Button';
import { InfoRow } from '../../../ui/molecules/InfoRow';
import { SectionCard } from '../../../ui/molecules/SectionCard';
import { formatDateLong } from '../../../utils/format';
import UpdateStatusModal from '../../produksi/UpdateStatusModal';
import TaskModal from '../../produksi/TaskModal';

const TaskPreviewPanel: React.FC = () => {
  const { 
    tasks, 
    selectedTaskId, 
    taskHistories, 
    loadTaskHistories, 
    updateTaskStatus 
  } = useWorkflowContext();
  
  const [showUpdateModal, setShowUpdateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [newComment, setNewComment] = React.useState('');
  const [submittingComment, setSubmittingComment] = React.useState(false);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Muat riwayat tugas saat task dipilih
  React.useEffect(() => {
    if (selectedTaskId) {
      loadTaskHistories(selectedTaskId);
    }
  }, [selectedTaskId]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !selectedTask.id || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      // Menambahkan komentar baru dengan mengupdate status yang sama
      await updateTaskStatus(
        selectedTask.id, 
        selectedTask.status, 
        newComment.trim(), 
        selectedTask.proof_path_or_link || undefined
      );
      setNewComment('');
    } catch (err) {
      console.error('Gagal menambahkan catatan/komentar:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!selectedTask) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
          Pilih task untuk melihat detail
        </p>
      </div>
    );
  }

  // Deteksi apakah bukti pekerjaan adalah gambar
  const isImageProof = selectedTask.proof_path_or_link && 
    /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(selectedTask.proof_path_or_link);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', padding: '20px', overflowY: 'auto', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
          Detail Task
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
          {selectedTask.naskah_title || `Naskah #${selectedTask.naskah_id}`}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Badge label={selectedTask.status} variant={getStatusVariant(selectedTask.status)} />
        <Badge label={selectedTask.step_name} variant="neutral" />
      </div>

      <SectionCard title="Informasi Task">
        <InfoRow label="Penanggung Jawab (PJ)" value={selectedTask.pic_name || '-'} />
        <InfoRow label="Tanggal Mulai" value={formatDateLong(selectedTask.start_date)} />
        <InfoRow label="Deadline" value={formatDateLong(selectedTask.due_date)} />
        {selectedTask.completed_date && (
          <InfoRow label="Tanggal Selesai" value={formatDateLong(selectedTask.completed_date)} />
        )}
      </SectionCard>

      {selectedTask.notes && (
        <SectionCard title="Catatan">
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {selectedTask.notes}
          </p>
        </SectionCard>
      )}

      {/* Visual Preview Bukti Kerja */}
      {selectedTask.proof_path_or_link && (
        <SectionCard title="Bukti / File Pekerjaan">
          {isImageProof ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <img 
                src={selectedTask.proof_path_or_link} 
                alt="Bukti Pekerjaan" 
                style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'block', maxHeight: '180px', objectFit: 'contain', background: '#00000010' }} 
              />
              <a
                href={selectedTask.proof_path_or_link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                🔗 Buka Gambar Penuh
              </a>
            </div>
          ) : (
            <a
              href={selectedTask.proof_path_or_link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
                textDecoration: 'none',
                fontSize: '13px',
                wordBreak: 'break-all',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
            >
              📄 {selectedTask.proof_path_or_link.length > 35 ? selectedTask.proof_path_or_link.substring(0, 35) + '...' : selectedTask.proof_path_or_link}
            </a>
          )}
        </SectionCard>
      )}

      {/* Catatan Kolaboratif & Aktivitas Tim */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Aktivitas & Komentar Tim
        </h3>
        
        {/* Riwayat aktivitas */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          maxHeight: '220px', 
          overflowY: 'auto', 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '10px' 
        }}>
          {taskHistories.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>
              Belum ada riwayat aktivitas atau komentar.
            </div>
          ) : (
            taskHistories.map((hist) => {
              const isStatusChange = hist.old_status !== hist.new_status;
              return (
                <div key={hist.id} style={{ 
                  fontSize: '12px', 
                  borderBottom: '1px solid var(--border)', 
                  paddingBottom: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      👤 {hist.changed_by || 'Anggota Tim'}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {new Date(hist.changed_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  {isStatusChange && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Mengubah status: <span style={{ textDecoration: 'line-through' }}>{hist.old_status || 'Awal'}</span> → <strong>{hist.new_status}</strong>
                    </div>
                  )}
                  {hist.notes && (
                    <div style={{ 
                      background: 'var(--bg-panel)', 
                      padding: '6px 8px', 
                      borderRadius: '6px', 
                      color: 'var(--text-primary)',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      borderLeft: '2.5px solid var(--accent)'
                    }}>
                      {hist.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input komentar baru */}
        <form onSubmit={handleSendComment} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Tulis catatan/komentar tim..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submittingComment}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '6px', 
              border: '1px solid var(--border)', 
              background: 'var(--bg-card)', 
              color: 'var(--text-primary)', 
              fontSize: '12px', 
              outline: 'none' 
            }}
          />
          <button 
            type="submit" 
            disabled={submittingComment || !newComment.trim()}
            style={{ 
              padding: '8px 14px', 
              borderRadius: '6px', 
              border: 'none', 
              background: newComment.trim() ? 'var(--accent)' : 'var(--border)', 
              color: '#ffffff', 
              fontSize: '12px', 
              fontWeight: '600', 
              cursor: newComment.trim() ? 'pointer' : 'default' 
            }}
          >
            Kirim
          </button>
        </form>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', paddingTop: '10px' }}>
        <Button fullWidth onClick={() => setShowUpdateModal(true)} variant="primary">
          Update Status
        </Button>
        <Button fullWidth onClick={() => setShowEditModal(true)} variant="secondary">
          Edit Task
        </Button>
      </div>

      {showUpdateModal && (
        <UpdateStatusModal
          task={selectedTask}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => {
            setShowUpdateModal(false);
            loadTaskHistories(selectedTask.id);
          }}
        />
      )}

      {showEditModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default TaskPreviewPanel;
