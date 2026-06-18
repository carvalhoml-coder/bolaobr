/* ==========================================================================
   BOLÃO BRASIL × HAITI - Supabase Integration
   ========================================================================== */

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const supabaseUrl = 'https://hxvlrpffecprmjjxunmn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmxycGZmZWNwcm1qanh1bm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjYwMzYsImV4cCI6MjA5Njk0MjAzNn0.Piq6BicgLSA6U82MKqXO7nP7duxt1Ixtiwabb54rQ1M';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const CONFIG = {
  prizePerPerson: 5,
  pixKey: '91992414247',
  pixName: 'Edwiges Roberta',
  pixType: 'Celular',
  gameCutoffDate: '2026-06-18T17:00:00Z' // Filtra palpites anteriores a esta data
};

// ─── STATE ───────────────────────────────────────────────────────────────────
let scoreBrasil = 0;
let scoreAdversario = 0;
let uploadedFile = null;
let currentModalId = null;
let participantsData = []; // Local cache da tabela
let guessesLocked = false; // Estado de bloqueio dos palpites

// Para salvar temporariamente durante o fluxo
let tempNome = '';
let tempPalpite = { brasil: 0, adversario: 0 };

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function goTo(screenId) {
  if (screenId === 'screen-palpite' && guessesLocked) {
    showToast('🔒 Os palpites para este jogo já estão encerrados.');
    return;
  }
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
    scoreAdversario = Math.max(0, scoreAdversario + delta);
    document.getElementById('score-haiti').textContent = scoreAdversario;
  }
  updatePalpitePreview();
}

function updatePalpitePreview() {
  const preview = document.getElementById('palpite-preview');
  preview.innerHTML = `Palpite: <strong>🇧🇷 Brasil ${scoreBrasil} × ${scoreAdversario} 🇭🇹 Haiti</strong>`;
}

// ─── SUBMIT PALPITE ──────────────────────────────────────────────────────────
function submitPalpite() {
  if (guessesLocked) {
    showToast('🔒 Os palpites já estão encerrados para este jogo.');
    return;
  }
  const inp = document.getElementById('inp-nome');
  const nome = inp.value.trim();

  if (!nome) {
    showToast('⚠️ Por favor, informe seu nome completo.');
    inp.focus();
    return;
  }

  tempNome = nome;
  tempPalpite = { brasil: scoreBrasil, adversario: scoreAdversario };

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
  if (guessesLocked) {
    showToast('🔒 Os palpites foram encerrados para este jogo.');
    return;
  }
  if (!uploadedFile) {
    showToast('⚠️ Envie o comprovante de pagamento para continuar.');
    return;
  }
  if (!tempNome) {
    showToast('⚠️ Sessão expirada. Volte e informe seu nome.');
    goTo('screen-palpite');
    return;
  }

  const btn = document.getElementById('btn-enviar');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⏳</span> Enviando...';
  btn.style.pointerEvents = 'none';

  // ── Variáveis do comprovante (podem ficar null se upload falhar)
  let comprovanteUrl = null;
  let comprovanteNome = uploadedFile ? uploadedFile.name : null;

  // ── 1. Tenta upload para o Storage (NÃO-BLOQUEANTE)
  if (uploadedFile) {
    try {
      const fileExt = (uploadedFile.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = ['jpg','jpeg','png','gif','webp','pdf'].includes(fileExt) ? fileExt : 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${safeExt}`;
      const filePath = `palpites/${fileName}`;

      console.log('[Bolão] Tentando upload:', filePath);

      const { error: uploadError } = await supabaseClient.storage
        .from('comprovantes')
        .upload(filePath, uploadedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadedFile.type || 'application/octet-stream'
        });

      if (uploadError) {
        // Upload falhou — registra aviso mas NÃO interrompe o fluxo
        console.warn('[Bolão] Upload falhou (seguindo sem comprovante):', uploadError.message);
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('comprovantes')
          .getPublicUrl(filePath);
        comprovanteUrl = urlData?.publicUrl || null;
        console.log('[Bolão] Upload OK. URL:', comprovanteUrl);
      }
    } catch (uploadErr) {
      console.warn('[Bolão] Erro inesperado no upload:', uploadErr);
      // Continua sem comprovante
    }
  }

  // ── 2. Salva no banco de dados (SEMPRE executa)
  try {
    console.log('[Bolão] Salvando participante:', tempNome, tempPalpite);

    const { error: insertError } = await supabaseClient
      .from('participants')
      .insert([{
        nome: tempNome,
        palpite_brasil: tempPalpite.brasil,
        palpite_adversario: tempPalpite.adversario,
        status: 'pending',
        comprovante_nome: comprovanteNome,
        comprovante_url: comprovanteUrl
      }]);

    if (insertError) {
      console.error('[Bolão] Erro ao inserir:', insertError);
      throw new Error(insertError.message);
    }

    console.log('[Bolão] Participante salvo com sucesso!');

    // ── 3. Limpar estado
    const nomeSalvo = tempNome;
    tempNome = '';
    uploadedFile = null;
    document.getElementById('inp-nome').value = '';
    scoreBrasil = 0;
    scoreAdversario = 0;
    document.getElementById('score-brasil').textContent = '0';
    document.getElementById('score-haiti').textContent = '0';
    updatePalpitePreview();
    removeFile();

    btn.innerHTML = originalHTML;
    btn.style.pointerEvents = 'auto';

    const aviso = comprovanteUrl ? '' : ' (comprovante pendente de verificação)';
    showToast(`🎉 Palpite de ${nomeSalvo} enviado!${aviso}`);

    await fetchParticipants();
    goTo('screen-dashboard');
    createConfetti();

  } catch (err) {
    console.error('[Bolão] Erro ao salvar palpite:', err);
    showToast('❌ Erro ao salvar palpite: ' + (err?.message || 'tente novamente.'));
    btn.innerHTML = originalHTML;
    btn.style.pointerEvents = 'auto';
  }
}

// ─── FETCH DADOS (SUPABASE) ──────────────────────────────────────────────────
async function fetchParticipants() {
  try {
    const { data, error } = await supabaseClient
      .from('participants')
      .select('*')
      .gt('created_at', CONFIG.gameCutoffDate)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Bolão] Erro ao buscar participantes:', error);
      return;
    }

    participantsData = data || [];

    if (document.getElementById('screen-landing').classList.contains('active')) renderLanding();
    if (document.getElementById('screen-dashboard').classList.contains('active')) renderDashboard();
    if (document.getElementById('screen-admin').classList.contains('active')) renderAdmin();
  } catch (err) {
    console.error('[Bolão] Erro inesperado em fetchParticipants:', err);
  }
}

// ─── REALTIME ────────────────────────────────────────────────────────────────
function setupRealtime() {
  supabaseClient
    .channel('public:participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
      fetchParticipants();
    })
    .subscribe();

  supabaseClient
    .channel('public:settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
      if (payload.new && payload.new.key === 'guesses_locked') {
        updateGuessesLockedState(payload.new.value);
      }
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
          <div class="part-palpite">🇧🇷 ${p.palpite_brasil} × ${p.palpite_adversario} 🇭🇹</div>
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

  updateGuessesLockedState(guessesLocked);

  const list = document.getElementById('admin-list');
  list.innerHTML = '';

  if (all.length === 0) {
    list.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum participante ainda.</li>';
    return;
  }

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
            ${statusName} · 🇧🇷 ${p.palpite_brasil} × ${p.palpite_adversario} 🇭🇹
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
  document.getElementById('modal-palpite').textContent = `Palpite: 🇧🇷 ${p.palpite_brasil} × ${p.palpite_adversario} 🇭🇹`;

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
    const { error } = await supabaseClient.from('participants')
      .update({ status: 'approved' })
      .eq('id', currentModalId);
    if (error) throw error;
    showToast('✅ Comprovante aprovado!');
  } catch (e) {
    console.error('[Bolão] Erro ao aprovar:', e);
    showToast('❌ Erro ao aprovar: ' + (e?.message || ''));
  }
  closeModal();
}

async function reprovar() {
  if (!currentModalId) return;
  try {
    const { error } = await supabaseClient.from('participants')
      .update({ status: 'rejected' })
      .eq('id', currentModalId);
    if (error) throw error;
    showToast('❌ Comprovante reprovado.');
  } catch (e) {
    console.error('[Bolão] Erro ao reprovar:', e);
    showToast('❌ Erro ao reprovar: ' + (e?.message || ''));
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
  }, 4000);
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

// ─── SETTINGS FETCH & WRITE ──────────────────────────────────────────────────
async function fetchSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('*');
    if (error) {
      console.error('[Bolão] Erro ao carregar settings:', error);
      return;
    }

    const lockSetting = (data || []).find(s => s.key === 'guesses_locked');
    if (lockSetting) {
      updateGuessesLockedState(lockSetting.value);
    }
  } catch (err) {
    console.error('[Bolão] Erro inesperado em fetchSettings:', err);
  }
}

function updateGuessesLockedState(locked) {
  guessesLocked = locked;

  const btnParticipar = document.getElementById('btn-participar');
  if (btnParticipar) {
    if (guessesLocked) {
      btnParticipar.disabled = true;
      btnParticipar.style.opacity = '0.6';
      btnParticipar.style.cursor = 'not-allowed';
      btnParticipar.innerHTML = `
        <span>Palpites encerrados</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      `;
    } else {
      btnParticipar.disabled = false;
      btnParticipar.style.opacity = '';
      btnParticipar.style.cursor = '';
      btnParticipar.innerHTML = `
        <span>Quero participar</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      `;
    }
  }

  const statusText = document.getElementById('lock-status-text');
  const lockIcon = document.getElementById('lock-icon');
  const btnToggle = document.getElementById('btn-toggle-lock');
  if (statusText && btnToggle && lockIcon) {
    if (guessesLocked) {
      statusText.textContent = 'Bloqueados';
      statusText.className = 'status-locked';
      lockIcon.textContent = '🔒';
      btnToggle.textContent = 'Desbloquear Palpites';
      btnToggle.className = 'btn-toggle-lock btn-unlock';
    } else {
      statusText.textContent = 'Abertos';
      statusText.className = 'status-open';
      lockIcon.textContent = '🔓';
      btnToggle.textContent = 'Bloquear Palpites';
      btnToggle.className = 'btn-toggle-lock';
    }
  }
}

async function toggleLockGuesses() {
  const nextState = !guessesLocked;
  const btnToggle = document.getElementById('btn-toggle-lock');
  const originalHTML = btnToggle.innerHTML;
  btnToggle.innerHTML = '⏳ Processando...';
  btnToggle.style.pointerEvents = 'none';

  try {
    const { error } = await supabaseClient
      .from('settings')
      .update({ value: nextState })
      .eq('key', 'guesses_locked');

    if (error) throw error;
    guessesLocked = nextState;
    updateGuessesLockedState(guessesLocked);
    showToast(nextState ? '🔒 Palpites bloqueados!' : '🔓 Palpites liberados!');
  } catch (e) {
    console.error('[Bolão] Erro ao alterar lock:', e);
    showToast('❌ Erro ao alterar status: ' + (e?.message || ''));
  } finally {
    btnToggle.innerHTML = originalHTML;
    btnToggle.style.pointerEvents = 'auto';
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Busca inicial dos dados e configurações
  fetchParticipants();
  fetchSettings();

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
