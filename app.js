/* ==========================================================================
   BOLÃO BRASIL × MARROCOS - Supabase Integration
   ========================================================================== */

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const supabaseUrl = 'https://hxvlrpffecprmjjxunmn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmxycGZmZWNwcm1qanh1bm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjYwMzYsImV4cCI6MjA5Njk0MjAzNn0.Piq6BicgLSA6U82MKqXO7nP7duxt1Ixtiwabb54rQ1M';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const CONFIG = {
  prizePerPerson: 5,
  pixKey: '91992414247',
  pixName: 'Edwiges Roberta',
  pixType: 'Celular'
};

// ─── STATE ───────────────────────────────────────────────────────────────────
let scoreBrasil = 0;
let scoreMarrocos = 0;
let uploadedFile = null;
let currentModalId = null;
let participantsData = []; // Local cache da tabela

// Para salvar temporariamente durante o fluxo
let tempNome = '';
let tempPalpite = { brasil: 0, marrocos: 0 };

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Renderiza ao entrar na tela se já temos dados
    if (screenId === 'screen-dashboard') renderDashboard();
    if (screenId === 'screen-admin') renderAdmin();
  }
}

function verificarAdmin() {
  const senha = prompt("Digite a senha do organizador:");
  if (senha === "bolao2026") {
    goTo('screen-admin');
  } else if (senha !== null) {
    showToast('❌ Senha incorreta.');
  }
}

// ─── SCORE STEPPER ────────────────────────────────────────────────────────────
function changeScore(team, delta) {
  if (team === 'brasil') {
    scoreBrasil = Math.max(0, scoreBrasil + delta);
    document.getElementById('score-brasil').textContent = scoreBrasil;
  } else {
    scoreMarrocos = Math.max(0, scoreMarrocos + delta);
    document.getElementById('score-marrocos').textContent = scoreMarrocos;
  }
  updatePalpitePreview();
}

function updatePalpitePreview() {
  const preview = document.getElementById('palpite-preview');
  preview.innerHTML = `Palpite: <strong>🇧🇷 Brasil ${scoreBrasil} × ${scoreMarrocos} 🇲🇦 Marrocos</strong>`;
}

// ─── SUBMIT PALPITE ──────────────────────────────────────────────────────────
function submitPalpite() {
  const inp = document.getElementById('inp-nome');
  const nome = inp.value.trim();

  if (!nome) {
    showToast('⚠️ Por favor, informe seu nome completo.');
    inp.focus();
    return;
  }

  tempNome = nome;
  tempPalpite = { brasil: scoreBrasil, marrocos: scoreMarrocos };

  goTo('screen-pix');
}

// ─── PIX COPY ─────────────────────────────────────────────────────────────────
function copyPix() {
  const key = document.getElementById('pix-key-text').textContent;
  navigator.clipboard.writeText(key).then(() => {
    const btn = document.getElementById('btn-copy-pix');
    const label = document.getElementById('copy-label');
    const originalText = label.textContent;

    btn.style.background = 'var(--color-green)';
    btn.style.color = 'var(--bg-dark)';
    label.textContent = 'Copiado!';

    showToast('Chave Pix copiada!');

    setTimeout(() => {
      btn.style.background = '';
      btn.style.color = '';
      label.textContent = originalText;
    }, 2500);
  }).catch(() => {
    showToast('Erro ao copiar. Tente selecionar o texto.');
  });
}

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFileUpload(event) {
  const file = event.target.files[0] || (event.dataTransfer && event.dataTransfer.files[0]);
  if (!file) return;

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast('⚠️ Arquivo muito grande. Máximo 5MB.');
    return;
  }

  uploadedFile = file;
  document.getElementById('upload-label').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  document.getElementById('upload-filename').textContent = file.name;
}

function removeFile() {
  uploadedFile = null;
  document.getElementById('file-comprovante').value = '';
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-label').classList.remove('hidden');
}

// ─── ENVIAR COMPROVANTE (SUPABASE) ───────────────────────────────────────────
async function enviarComprovante() {
  if (!uploadedFile) {
    showToast('⚠️ Envie o comprovante de pagamento para continuar.');
    return;
  }

  const btn = document.getElementById('btn-enviar');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⏳</span> Enviando...';
  btn.style.pointerEvents = 'none';

  try {
    // 1. Upload do arquivo para o Storage
    const fileExt = uploadedFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `palpites/${fileName}`;

    const { error: uploadError, data: uploadData } = await supabaseClient.storage
      .from('comprovantes')
      .upload(filePath, uploadedFile);

    if (uploadError) throw uploadError;

    // Pegar URL publica do arquivo
    const { data: publicUrlData } = supabaseClient.storage
      .from('comprovantes')
      .getPublicUrl(filePath);

    // 2. Inserir no Banco de Dados
    const { error: insertError } = await supabaseClient
      .from('participants')
      .insert([
        {
          nome: tempNome,
          palpite_brasil: tempPalpite.brasil,
          palpite_marrocos: tempPalpite.marrocos,
          status: 'pending', // Fica pendente até aprovação do admin
          comprovante_nome: uploadedFile.name,
          comprovante_url: publicUrlData.publicUrl
        }
      ]);

    if (insertError) throw insertError;

    // Limpar state
    tempNome = '';
    uploadedFile = null;

    btn.innerHTML = originalHTML;
    btn.style.pointerEvents = 'auto';

    showToast('🎉 Palpite enviado! Aguardando aprovação.');

    // Busca os dados atualizados
    await fetchParticipants();
    goTo('screen-dashboard');
    createConfetti();

  } catch (error) {
    console.error('Erro ao enviar:', error);
    showToast('❌ Ocorreu um erro ao enviar. Tente novamente.');
    btn.innerHTML = originalHTML;
    btn.style.pointerEvents = 'auto';
  }
}

// ─── FETCH DADOS (SUPABASE) ──────────────────────────────────────────────────
async function fetchParticipants() {
  const { data, error } = await supabaseClient
    .from('participants')
    .select('*')
    .order('created_at', { ascending: true }); // Ordem cronológica

  if (error) {
    console.error('Erro ao buscar dados:', error);
    return;
  }

  participantsData = data || [];

  if (document.getElementById('screen-landing').classList.contains('active')) renderLanding();
  if (document.getElementById('screen-dashboard').classList.contains('active')) renderDashboard();
  if (document.getElementById('screen-admin').classList.contains('active')) renderAdmin();
}

// ─── REALTIME ────────────────────────────────────────────────────────────────
function setupRealtime() {
  supabaseClient
    .channel('public:participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, payload => {
      // Quando algo mudar no banco, busca os dados de novo e re-renderiza
      fetchParticipants();
    })
    .subscribe();
}

// ─── RENDERS ─────────────────────────────────────────────────────────────────
function renderLanding() {
  const approvedCount = participantsData.filter(p => p.status === 'approved').length;
  const total = approvedCount * CONFIG.prizePerPerson;

  document.getElementById('landing-prize').textContent = `R$ ${total}`;
  document.getElementById('landing-count').textContent = `${approvedCount} participante${approvedCount !== 1 ? 's' : ''}`;
}

function renderDashboard() {
  const approvedCount = participantsData.filter(p => p.status === 'approved').length;
  const total = approvedCount * CONFIG.prizePerPerson;

  document.getElementById('prize-total').textContent = `R$ ${total}`;
  document.getElementById('prize-per').textContent = `R$ ${CONFIG.prizePerPerson}`;
  document.getElementById('section-count').textContent = `${approvedCount} participante${approvedCount !== 1 ? 's' : ''}`;

  const list = document.getElementById('participants-list');
  list.innerHTML = '';

  const approved = participantsData.filter(p => p.status === 'approved');

  if (approved.length === 0) {
    list.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum palpite aprovado ainda.</li>';
    return;
  }

  approved.forEach((p, index) => {
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    const rankNum = index + 1;

    const badges = [];
    if (p.is_organizer) badges.push('<span class="badge badge-org">Organizador</span>');

    list.innerHTML += `
      <li class="participant-card animate-in" style="--delay:${index * 0.05}s">
        <div class="part-rank ${rankClass}">${rankNum}º</div>
        <div class="part-info">
          <div class="part-header">
            <span class="part-name">${escHtml(p.nome)}</span>
            ${badges.join('')}
          </div>
          <div class="part-palpite">🇧🇷 ${p.palpite_brasil} × ${p.palpite_marrocos} 🇲🇦</div>
        </div>
      </li>
    `;
  });
}

function renderAdmin() {
  const all = participantsData;
  const pending = all.filter(p => p.status === 'pending');
  const approved = all.filter(p => p.status === 'approved');
  const rejected = all.filter(p => p.status === 'rejected');

  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-pendente').textContent = pending.length;
  document.getElementById('stat-aprovado').textContent = approved.length;
  document.getElementById('stat-reprovado').textContent = rejected.length;

  const list = document.getElementById('admin-list');
  list.innerHTML = '';

  if (all.length === 0) {
    list.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum participante ainda.</li>';
    return;
  }

  // Pendentes primeiro, depois aprovados, depois reprovados
  const sorted = [...pending, ...approved, ...rejected];

  sorted.forEach(p => {
    let statusName = 'Pendente';
    if (p.status === 'approved') statusName = 'Aprovado';
    if (p.status === 'rejected') statusName = 'Reprovado';

    list.innerHTML += `
      <li class="admin-item">
        <div class="admin-item-info">
          <div class="admin-item-name">${escHtml(p.nome)}</div>
          <div class="admin-item-sub status-${p.status}">
            <div class="status-dot"></div>
            ${statusName} · 🇧🇷 ${p.palpite_brasil} × ${p.palpite_marrocos} 🇲🇦
          </div>
        </div>
        <button class="btn-view" onclick="openModal('${p.id}')">Ver doc</button>
      </li>
    `;
  });
}

// ─── ADMIN MODAL & ACTIONS ───────────────────────────────────────────────────
function openModal(id) {
  const p = participantsData.find(x => x.id === id);
  if (!p) return;
  currentModalId = id;

  document.getElementById('modal-nome').textContent = p.nome;
  document.getElementById('modal-palpite').textContent = `Palpite: 🇧🇷 ${p.palpite_brasil} × ${p.palpite_marrocos} 🇲🇦`;

  const preview = document.getElementById('modal-file-preview');
  if (p.comprovante_url) {
    preview.innerHTML = `
      <a href="${p.comprovante_url}" target="_blank">
        <img src="${p.comprovante_url}" alt="Comprovante" onerror="this.outerHTML='<p>Ver documento anexo</p>'"/>
      </a>
      <a href="${p.comprovante_url}" target="_blank" style="display:inline-block; margin-top:12px; color:var(--color-green); text-decoration:none; font-weight:bold;">↗ Abrir Imagem Original</a>
    `;
  } else {
    preview.innerHTML = '<p style="color:var(--text-muted)">Nenhum comprovante anexado.</p>';
  }

  // Update button states
  const btnApprove = document.getElementById('btn-aprovar');
  const btnReject = document.getElementById('btn-reprovar');

  if (p.status === 'approved') {
    btnApprove.style.display = 'none';
    btnReject.style.display = 'block';
  } else if (p.status === 'rejected') {
    btnApprove.style.display = 'block';
    btnReject.style.display = 'none';
  } else {
    btnApprove.style.display = 'block';
    btnReject.style.display = 'block';
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-box').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').classList.add('hidden');
  currentModalId = null;
}

async function aprovar() {
  if (!currentModalId) return;
  try {
    await supabaseClient.from('participants')
      .update({ status: 'approved' })
      .eq('id', currentModalId);
    showToast('✅ Comprovante aprovado!');
  } catch (e) {
    showToast('❌ Erro ao aprovar.');
  }
  closeModal();
}

async function reprovar() {
  if (!currentModalId) return;
  try {
    await supabaseClient.from('participants')
      .update({ status: 'rejected' })
      .eq('id', currentModalId);
    showToast('❌ Comprovante reprovado.');
  } catch (e) {
    showToast('❌ Erro ao reprovar.');
  }
  closeModal();
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');

  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = null;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.style.animation = 'slideUp 0.3s ease reverse forwards';
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 3000);
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Simple CSS confetti
function createConfetti() {
  for (let i = 0; i < 30; i++) {
    const conf = document.createElement('div');
    conf.style.position = 'fixed';
    conf.style.width = '10px';
    conf.style.height = '10px';
    conf.style.backgroundColor = ['#00d24a', '#f0c040', '#ff4d53', '#ffffff'][Math.floor(Math.random() * 4)];
    conf.style.top = '-10px';
    conf.style.left = Math.random() * 100 + 'vw';
    conf.style.zIndex = '9999';
    conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    conf.style.transition = 'all 2s ease-out';
    conf.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(conf);

    setTimeout(() => {
      conf.style.top = '100vh';
      conf.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 100 - 50}px)`;
      conf.style.opacity = '0';
    }, 50);

    setTimeout(() => conf.remove(), 2000);
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Busca inicial dos dados
  fetchParticipants();

  // Ativa o Realtime
  setupRealtime();

  // Drag and Drop Zone
  const zone = document.getElementById('upload-label');
  if (zone) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.parentElement.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => {
      zone.parentElement.classList.remove('dragover');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.parentElement.classList.remove('dragover');
      handleFileUpload(e);
    });

    // Keyboard accessibility for file upload
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('file-comprovante').click();
      }
    });
  }

  // Custom global CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
});
