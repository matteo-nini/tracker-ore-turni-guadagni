// Global state
let currentUser = null;
let userSettings = null;
let shifts = [];

// Base URL for API calls - usa il percorso completo del tuo sito
const API_BASE = 'https://matteon20.sg-host.com/api/';

// Default iniziale per la tariffa oraria (da usare solo se non salvata)
const CONTRACT_RATE_DEFAULT = 300 / 32.4; 

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        loadUserData();
        showScreen('mainApp');
    } else {
        showScreen('loginScreen');
    }
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('showRegisterBtn').addEventListener('click', () => showScreen('registerScreen'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('backToLoginBtn').addEventListener('click', () => showScreen('loginScreen'));
    
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.currentTarget.getAttribute('data-view');
            switchView(view);
        });
    });
    
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addShiftBtn').addEventListener('click', () => showShiftForm());
    document.getElementById('shiftFormElement').addEventListener('submit', handleSaveShift);
    document.getElementById('cancelShiftBtn').addEventListener('click', hideShiftForm);
    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
    document.getElementById('passwordForm').addEventListener('submit', handleChangePassword);
    document.getElementById('deleteProfileBtn').addEventListener('click', handleDeleteProfile);
    document.getElementById('registerPayslipBtn').addEventListener('click', showPayslipModal);
    document.getElementById('payslipForm').addEventListener('submit', handlePayslipSubmit);
    
    // Il filtro è ora solo nella vista riepilogo
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', updateSummaryView);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(i => i.classList.remove('active'));
    
    const viewElement = document.getElementById(viewName + 'View');
    if (viewElement) {
        viewElement.classList.add('active');
    }
    const navElement = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navElement) {
        navElement.classList.add('active');
    }
    
    if (viewName === 'dashboard') updateDashboard(); 
    if (viewName === 'shifts') updateShiftsList();
    if (viewName === 'settings') loadSettings();
    if (viewName === 'summary') updateSummaryView(); // Aggiorna solo quando si entra
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(API_BASE + 'login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = username;
            localStorage.setItem('currentUser', username);
            await loadUserData();
            showScreen('mainApp');
            switchView('dashboard');
        } else {
            alert('Username o password errati');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Errore durante il login');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regPasswordConfirm').value;
    
    if (password !== confirmPassword) {
        alert('Le password non coincidono');
        return;
    }
    
    try {
        const response = await fetch(API_BASE + 'register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Profilo creato con successo!');
            document.getElementById('registerForm').reset();
            showScreen('loginScreen');
        } else {
            alert(result.message || 'Errore durante la registrazione');
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('Errore durante la registrazione');
    }
}

function handleLogout() {
    if (confirm('Sei sicuro di voler uscire?')) {
        currentUser = null;
        userSettings = null;
        shifts = [];
        localStorage.removeItem('currentUser');
        showScreen('loginScreen');
        document.getElementById('loginForm').reset();
    }
}

async function loadUserData() {
    try {
        const settingsResponse = await fetch(API_BASE + `get_settings.php?username=${currentUser}`, {method: 'GET'});

        userSettings = await settingsResponse.json();
        
        // Assicura che la tariffa contrattuale esista, altrimenti usa il default
        if (userSettings && userSettings.contractRate === undefined) {
             userSettings.contractRate = CONTRACT_RATE_DEFAULT;
        }

        const shiftsResponse = await fetch(API_BASE + `get_shifts.php?username=${currentUser}`, {method: 'GET'});
        const shiftsData = await shiftsResponse.text();
        shifts = parseCSV(shiftsData);
        updateDashboard();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length <= 1) return [];

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 5) { // Ensure all fields are present
            data.push({
                date: parts[0],
                start: parts[1],
                end: parts[2],
                notes: parts[3],
                status: parts[4]
            });
        } else {
            console.warn(`Riga non valida nel CSV: ${line}`);
        }
    }
    return data;
}

function shiftsToCSV(shiftsArray) {
    let csv = 'Data,Entrata,Uscita,Note,Stato\n';
    shiftsArray.forEach(shift => {
        csv += `${shift.date},${shift.start},${shift.end},${shift.notes || ''},${shift.status}\n`;
    });
    return csv;
}

function calculateHours(start, end) {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let hours = endHour - startHour;
    let minutes = endMin - startMin;

    // Handle crossing midnight
    if (hours < 0) {
        hours += 24;
    }

    if (minutes < 0) {
        hours--;
        minutes += 60;
    }

    return hours + minutes / 60;
}

function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    // Imposta al giovedì della settimana per standardizzare il calcolo (ISO)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7)); 
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calcola il numero di settimane
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isShiftExtra(shiftDate) {
    if (!userSettings || !userSettings.contractStartDate) return false; // Non trattare come extra se manca la data
    const contractStart = new Date(userSettings.contractStartDate);
    const shift = new Date(shiftDate);
    // True se il turno è prima dell'inizio del contratto
    return shift < contractStart;
}

// Determina se un turno è di tipo 'extra' o 'contract' basandosi sul cap settimanale.
function getShiftType(shift) {
    // 1. Check extra due to contract start date
    if (isShiftExtra(shift.date)) return 'extra';

    const weeklyContract = userSettings?.weeklyHours || 18;
    const week = getWeekNumber(shift.date);
    
    // 2. Trova tutti i turni non extra della settimana, ordinati cronologicamente
    const weekShifts = shifts
        .filter(s => getWeekNumber(s.date) === week && !isShiftExtra(s.date))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let usedContract = 0;

    for (const s of weekShifts) {
        const hours = calculateHours(s.start, s.end);
        const remainingContract = Math.max(0, weeklyContract - usedContract);
        const allocatedContract = Math.min(hours, remainingContract);
        
        // Verifica se questo è il turno target
        if (s.date === shift.date && s.start === shift.start && s.end === shift.end) {
            // Se ha contribuito con ore contrattuali (anche se parzialmente)
            return allocatedContract > 0 ? 'contract' : 'extra'; 
        }
        
        usedContract += allocatedContract;
    }
    return 'contract'; // Fallback
}


function getMonthShifts(month, year) {
    return shifts.filter(s => {
        const d = new Date(s.date);
        // Usa getMonth() che è 0-based
        return d.getMonth() === month && d.getFullYear() === year; 
    });
}

function calculateWeeklyStats(year, week) {
    const weekShifts = shifts.filter(s => {
        const d = new Date(s.date);
        return d.getFullYear() === year && getWeekNumber(s.date) === week;
    });
    
    let totalHours = 0;
    weekShifts.forEach(s => {
        totalHours += calculateHours(s.start, s.end);
    });
    
    return { totalHours };
}

// LOGICA FONDAMENTALE PER LA DIVISIONE CONTRATTO/EXTRA
function calculateMonthlyStats(month, year) {
    let contractHours = 0;
    let extraHours = 0;
    const weeklyContract = userSettings?.weeklyHours || 18;
    const weekContractUsed = new Map(); // Map<Year-WeekKey, UsedContractHours>

    // 1. Ordina tutti i turni cronologicamente per garantire una corretta allocazione
    const allSortedShifts = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date));

    allSortedShifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        const shiftMonth = shiftDate.getMonth();
        const shiftYear = shiftDate.getFullYear();
        const week = getWeekNumber(shift.date);
        const key = `${shiftYear}-${week}`;
        const shiftHours = calculateHours(shift.start, shift.end);
        
        let allocatedContract = 0;
        let allocatedExtra = 0;

        // 1a. Check for "Extra" due to contract start date
        if (isShiftExtra(shift.date)) {
            allocatedExtra = shiftHours;
        } else {
            // 1b. Weekly Contract Allocation (solo se non è extra per data)
            const used = weekContractUsed.get(key) || 0;
            const remainingContract = Math.max(0, weeklyContract - used);

            allocatedContract = Math.min(shiftHours, remainingContract);
            allocatedExtra = shiftHours - allocatedContract;

            // Aggiorna il totale utilizzato per la settimana
            weekContractUsed.set(key, used + allocatedContract);
        }

        // 1c. Conta solo l'allocazione se il turno cade nel mese target
        if (shiftMonth === month && shiftYear === year) {
            contractHours += allocatedContract;
            extraHours += allocatedExtra;
        }
    });

    return { contractHours, extraHours };
}

// Funzione di utilità per salvare le impostazioni
async function saveSettings() {
    try {
        const response = await fetch(API_BASE + 'save_settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, settings: userSettings })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Save settings error:', error);
        return false;
    }
}


function updateDashboard() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getWeekNumber(now.toLocaleDateString('en-CA'));
    const currentMonth = now.getMonth();
    
    // Tariffe Dinamiche
    const contractRate = userSettings?.contractRate || CONTRACT_RATE_DEFAULT; 
    const extraRate = userSettings?.extraRate || 10;
    
    // Stats Settimanali e Mensili (Ore)
    const weekStats = calculateWeeklyStats(currentYear, currentWeek);
    document.getElementById('weekHours').textContent = weekStats.totalHours.toFixed(1) + 'h';
    
    const monthShifts = getMonthShifts(currentMonth, currentYear);
    let monthTotal = 0;
    monthShifts.forEach(s => monthTotal += calculateHours(s.start, s.end));
    document.getElementById('monthHours').textContent = monthTotal.toFixed(1) + 'h';
    
    // Calcolo Guadagni Mese Corrente (usa l'allocazione)
    const monthStats = calculateMonthlyStats(currentMonth, currentYear);
    
    const contractEarnings = monthStats.contractHours * contractRate; 
    const extraEarnings = monthStats.extraHours * extraRate; 
    
    document.getElementById('contractEarnings').textContent = '€' + contractEarnings.toFixed(2);
    document.getElementById('extraEarnings').textContent = '€' + extraEarnings.toFixed(2);
    
    // Calcolo Pagamenti TOTALI (Ora CUMULATIVO su TUTTI i turni)
    let paidContract = 0, pendingContract = 0, paidExtra = 0, pendingExtra = 0;
    const weeklyContract = userSettings?.weeklyHours || 18;
    const weekContractUsed = new Map();
    
    // Iterazione su TUTTI i turni (non solo il mese corrente) per il calcolo cumulativo
    const allSortedShifts = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    allSortedShifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        const shiftYear = shiftDate.getFullYear();
        
        const week = getWeekNumber(shift.date);
        const key = `${shiftYear}-${week}`;
        const shiftHours = calculateHours(shift.start, shift.end);
        
        let allocatedContract = 0;
        let allocatedExtra = 0;

        // 1. Check for "Extra" due to contract start date
        if (isShiftExtra(shift.date)) {
            allocatedExtra = shiftHours;
        } else {
            // 2. Weekly Contract Allocation 
            const used = weekContractUsed.get(key) || 0;
            const remainingContract = Math.max(0, weeklyContract - used);

            allocatedContract = Math.min(shiftHours, remainingContract);
            allocatedExtra = shiftHours - allocatedContract;

            weekContractUsed.set(key, used + allocatedContract);
        }
        
        // 3. Track Earnings based on status (split by allocated hours)
        
        const contractEarningsSegment = allocatedContract * contractRate;
        if (shift.status === 'paid') paidContract += contractEarningsSegment;
        else pendingContract += contractEarningsSegment; // Contributo al pending
        
        const extraEarningsSegment = allocatedExtra * extraRate;
        if (shift.status === 'paid') paidExtra += extraEarningsSegment;
        else pendingExtra += extraEarningsSegment; // Contributo al pending
    });
    
    // Aggiornamento dei box pagamento (ora cumulativo)
    document.getElementById('paidContract').textContent = '€' + paidContract.toFixed(2);
    document.getElementById('pendingContract').textContent = '€' + pendingContract.toFixed(2);
    document.getElementById('paidExtra').textContent = '€' + paidExtra.toFixed(2);
    document.getElementById('pendingExtra').textContent = '€' + pendingExtra.toFixed(2);
}

function showShiftForm(editIndex = null) {
    document.getElementById('shiftForm').style.display = 'block';
    
    if (editIndex !== null) {
        document.getElementById('formTitle').textContent = 'Modifica Turno';
        document.getElementById('editShiftIndex').value = editIndex;
        const shift = shifts[editIndex];
        document.getElementById('shiftDate').value = shift.date;
        document.getElementById('shiftStart').value = shift.start;
        document.getElementById('shiftEnd').value = shift.end;
        document.getElementById('shiftNotes').value = shift.notes;
    } else {
        document.getElementById('formTitle').textContent = 'Nuovo Turno';
        document.getElementById('editShiftIndex').value = '';
        document.getElementById('shiftFormElement').reset();
        // Imposta la data al giorno corrente
        document.getElementById('shiftDate').valueAsDate = new Date();
    }
    
    document.getElementById('shiftForm').scrollIntoView({ behavior: 'smooth' });
}

function hideShiftForm() {
    document.getElementById('shiftForm').style.display = 'none';
    document.getElementById('shiftFormElement').reset();
}

async function handleSaveShift(e) {
    e.preventDefault();
    
    const editIndex = document.getElementById('editShiftIndex').value;
    const shift = {
        date: document.getElementById('shiftDate').value,
        start: document.getElementById('shiftStart').value,
        end: document.getElementById('shiftEnd').value,
        notes: document.getElementById('shiftNotes').value,
        status: 'pending'
    };
    
    if (editIndex !== '') {
        shift.status = shifts[editIndex].status;
        shifts[editIndex] = shift;
    } else {
        shifts.push(shift);
    }
    
    shifts.sort((a, b) => new Date(b.date) - new Date(a.date));
    await saveShifts();
    hideShiftForm();
    updateShiftsList();
    updateDashboard();
    
    // Se la vista attiva è il riepilogo, aggiornala.
    if (document.getElementById('summaryView').classList.contains('active')) {
        updateSummaryView();
    }
}

async function deleteShift(index) {
    if (confirm('Sei sicuro di voler eliminare questo turno?')) {
        shifts.splice(index, 1);
        await saveShifts();
        updateShiftsList();
        updateDashboard();
        if (document.getElementById('summaryView').classList.contains('active')) {
            updateSummaryView();
        }
    }
}

async function toggleShiftStatus(index) {
    shifts[index].status = shifts[index].status === 'paid' ? 'pending' : 'paid';
    await saveShifts();
    updateShiftsList();
    updateDashboard();
    if (document.getElementById('summaryView').classList.contains('active')) {
        updateSummaryView();
    }
}

async function saveShifts() {
    try {
        const response = await fetch(API_BASE + 'save_shifts.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, shifts: shiftsToCSV(shifts) })
        });
        return await response.json();
    } catch (error) {
        console.error('Save shifts error:', error);
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function updateShiftsList() {
    const container = document.getElementById('shiftsList');
    
    if (shifts.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessun turno inserito. Clicca su "Aggiungi Turno" per iniziare.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    shifts.forEach((shift, index) => {
        const hours = calculateHours(shift.start, shift.end);
        
        // Usa la nuova funzione getShiftType per la visualizzazione
        const type = getShiftType(shift);
        const isExtraType = type === 'extra';
        const typeLabel = isExtraType ? 'Extra' : 'Contratto';
        
        const statusLabel = shift.status === 'paid' ? 'Pagato' : 'Da pagare';
        
        const item = document.createElement('div');
        item.className = 'shift-item';
        item.innerHTML = `
            <div class="shift-info">
                <div class="shift-date">${formatDate(shift.date)}</div>
                <div class="shift-time">${shift.start} - ${shift.end}</div>
                <div class="shift-hours">${hours.toFixed(1)}h 
                    <span class="shift-badge ${type}">${typeLabel}</span>
                    ${isExtraType ? `<span class="shift-badge ${shift.status}">${statusLabel}</span>` : ''}
                </div>
                ${shift.notes ? `<div class="shift-notes">${shift.notes}</div>` : ''}
            </div>
            <div class="shift-actions">
                <button class="icon-btn" onclick="showShiftForm(${index})" title="Modifica">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                </button>
                ${isShiftExtra(shift.date) ? `
                <button class="icon-btn" onclick="toggleShiftStatus(${index})" title="${shift.status === 'paid' ? 'Segna da pagare' : 'Segna pagato'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>
                ` : ''}
                <button class="icon-btn" onclick="deleteShift(${index})" title="Elimina">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function updateSummaryView() {
    // Aggiungo un controllo per evitare l'errore se la vista non è attiva (dovrebbe essere stata risolta, ma meglio tenere il controllo)
    const summaryTotalHoursEl = document.getElementById('summaryTotalHours');
    if (!summaryTotalHoursEl) {
        return; 
    }
    
    const monthFilter = document.getElementById('monthFilter').value;
    let shiftsToAnalyze = shifts;
    
    let currentFilterYear, currentFilterMonth;
    
    // 1. FILTRAGGIO
    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        currentFilterYear = year;
        currentFilterMonth = month - 1; // month - 1 perché i mesi JS sono 0-based
        shiftsToAnalyze = getMonthShifts(currentFilterMonth, currentFilterYear); 
    }
    
    const totalHours = shiftsToAnalyze.reduce((acc, shift) => acc + calculateHours(shift.start, shift.end), 0);
    
    let contractHours = 0;
    let extraHours = 0;
    
    // 2. CALCOLO ALLOCAZIONE (necessario fare l'allocazione su tutti i turni se il filtro è 'Tutti')
    if (monthFilter) {
        const monthStats = calculateMonthlyStats(currentFilterMonth, currentFilterYear);
        contractHours = monthStats.contractHours;
        extraHours = monthStats.extraHours;
    } else {
        // Ricalcolo dell'allocazione su tutti i turni (non solo quelli in shiftsToAnalyze)
        const weeklyContract = userSettings?.weeklyHours || 18;
        const weekContractUsed = new Map();
        
        const allSortedShifts = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        allSortedShifts.forEach(shift => {
            const shiftDate = new Date(shift.date);
            const shiftYear = shiftDate.getFullYear();
            const week = getWeekNumber(shift.date);
            const key = `${shiftYear}-${week}`;
            const shiftHours = calculateHours(shift.start, shift.end);
            
            let allocatedContract = 0;
            let allocatedExtra = 0;

            if (isShiftExtra(shift.date)) {
                allocatedExtra = shiftHours;
            } else {
                const used = weekContractUsed.get(key) || 0;
                const remainingContract = Math.max(0, weeklyContract - used);

                allocatedContract = Math.min(shiftHours, remainingContract);
                allocatedExtra = shiftHours - allocatedContract;

                weekContractUsed.set(key, used + allocatedContract);
            }
            
            // Si sommano tutte le ore (per il riepilogo "Tutti")
            contractHours += allocatedContract;
            extraHours += allocatedExtra;
        });
    }

    const contractRate = userSettings?.contractRate || CONTRACT_RATE_DEFAULT; 
    const extraRate = userSettings?.extraRate || 10;

    const contractEarnings = contractHours * contractRate;
    const extraEarnings = extraHours * extraRate;
    const totalEarnings = contractEarnings + extraEarnings;
    
    // 3. AGGIORNAMENTO STATISTICHE
    summaryTotalHoursEl.textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('summaryContractHours').textContent = contractHours.toFixed(1) + 'h';
    document.getElementById('summaryContractEarnings').textContent = '(€' + contractEarnings.toFixed(2) + ')';
    document.getElementById('summaryExtraHours').textContent = extraHours.toFixed(1) + 'h';
    document.getElementById('summaryExtraEarnings').textContent = '(€' + extraEarnings.toFixed(2) + ')';
    document.getElementById('summaryTotalEarnings').textContent = '€' + totalEarnings.toFixed(2);
    
    const tbody = document.getElementById('summaryTableBody');
    
    // <--- CONTROLLO CRITICO AGGIUNTO --->
    if (!tbody) {
        console.error("Errore: Elemento <tbody> con ID 'summaryTableBody' non trovato nel DOM.");
        return; 
    }
    
    // 4. AGGIORNAMENTO TABELLA
    if (shiftsToAnalyze.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nessun turno da visualizzare</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    shiftsToAnalyze.forEach((shift) => {
        const hours = calculateHours(shift.start, shift.end);
        
        const type = getShiftType(shift);
        const isExtraType = type === 'extra';
        const typeLabel = isExtraType ? 'Extra' : 'Contratto';
        
        const status = shift.status === 'paid' ? 'Pagato' : 'Da pagare';
        const originalIndex = shifts.indexOf(shift);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(shift.date)}</td>
            <td>${shift.start}</td>
            <td>${shift.end}</td>
            <td>${hours.toFixed(1)}h</td>
            <td><span class="shift-badge ${isExtraType ? 'extra' : 'contract'}">${typeLabel}</span></td>
            <td><span class="shift-badge ${shift.status}">${status}</span></td>
            <td>${shift.notes}</td>
            <td>
                <div class="shift-actions">
                    <button class="icon-btn" onclick="showShiftForm(${originalIndex}); switchView('shifts');" title="Modifica">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                    </button>
                    ${isExtraType ? `
                    <button class="icon-btn" onclick="toggleShiftStatus(${originalIndex}); updateSummaryView();" title="Cambia stato">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    ` : ''}
                    <button class="icon-btn" onclick="deleteShift(${originalIndex}); updateSummaryView();" title="Elimina">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // 5. POPOLA FILTRO
    if (document.getElementById('monthFilter') && document.getElementById('monthFilter').options.length === 1) {
        populateMonthFilter();
    }
}

function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    if (!select) return; 
    
    const months = new Set();
    
    shifts.forEach(shift => {
        const d = new Date(shift.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(key);
    });
    
    const sortedMonths = Array.from(months).sort().reverse();
    
    sortedMonths.forEach(month => {
        const [year, m] = month.split('-');
        // Mese 0-based
        const date = new Date(year, parseInt(m) - 1); 
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = month;
        // Iniziale maiuscola
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1); 
        select.appendChild(option);
    });
}

function loadSettings() {
    if (userSettings) {
        document.getElementById('contractStartDate').value = userSettings.contractStartDate || '2024-10-21';
        document.getElementById('weeklyHours').value = userSettings.weeklyHours || 18;
        document.getElementById('extraRate').value = userSettings.extraRate || 10;
        // La tariffa contrattuale è gestita internamente/tramite Payslip Modal
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    // Mantiene l'eventuale contractRate precedentemente salvato
    const existingContractRate = userSettings?.contractRate; 
    
    userSettings = {
        contractStartDate: document.getElementById('contractStartDate').value,
        weeklyHours: parseFloat(document.getElementById('weeklyHours').value),
        extraRate: parseFloat(document.getElementById('extraRate').value),
        contractRate: existingContractRate || CONTRACT_RATE_DEFAULT // Conserva il rate o usa il default
    };
    
    const success = await saveSettings();
        
    if (success) {
        alert('Impostazioni salvate con successo!');
        updateDashboard();
    } else {
        alert('Errore durante il salvataggio');
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmNewPassword) {
        alert('Le nuove password non coincidono');
        return;
    }
    
    try {
        const response = await fetch(API_BASE + 'change_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, currentPassword, newPassword })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Password cambiata con successo!');
            document.getElementById('passwordForm').reset();
        } else {
            alert(result.message || 'Errore durante il cambio password');
        }
    } catch (error) {
        console.error('Change password error:', error);
        alert('Errore durante il cambio password');
    }
}

async function handleDeleteProfile() {
    if (!confirm('Sei sicuro di voler eliminare il tuo profilo? Questa azione è irreversibile!')) return;
    if (!confirm('ATTENZIONE: Tutti i tuoi dati verranno eliminati. Confermi?')) return;
    
    try {
        const response = await fetch(API_BASE + 'delete_profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Profilo eliminato con successo');
            handleLogout();
        } else {
            alert('Errore durante l\'eliminazione del profilo');
        }
    } catch (error) {
        console.error('Delete profile error:', error);
        alert('Errore durante l\'eliminazione del profilo');
    }
}

function showPayslipModal() {
    const modal = document.getElementById('payslipModal');
    const select = document.getElementById('payslipMonth');
    
    select.innerHTML = '';
    const now = new Date();
    
    // Popola i mesi con l'anno corretto (ultimi 12 mesi)
    for (let i = 0; i < 12; i++) {
        // Calcola il mese corrente e i 11 precedenti
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1); 
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        // Il valore deve essere Anno-Mese (0-11)
        const value = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`; 
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        select.appendChild(option);
    }
    
    // Pulisci i campi
    document.getElementById('payslipHours').value = '';
    document.getElementById('payslipAmount').value = '';

    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function handlePayslipSubmit(e) {
    e.preventDefault();
    
    const monthValue = document.getElementById('payslipMonth').value;
    const [year, month] = monthValue.split('-').map(Number); // month è 0-based
    
    const payslipHours = parseFloat(document.getElementById('payslipHours').value);
    const payslipAmount = parseFloat(document.getElementById('payslipAmount').value);
    
    // 1. Segna i turni come pagati
    shifts.forEach(shift => {
        const d = new Date(shift.date);
        // Segna come 'paid' solo i turni di contratto (che non sono extra per data)
        if (d.getFullYear() === year && d.getMonth() === month && !isShiftExtra(shift.date)) { 
            shift.status = 'paid';
        }
    });
    
    // 2. Calcola e salva la nuova tariffa se i dati sono forniti
    let rateUpdated = false;
    if (payslipHours > 0 && payslipAmount >= 0) {
        const newRate = payslipAmount / payslipHours;
        userSettings.contractRate = newRate;
        
        // Salva le impostazioni con la nuova tariffa
        rateUpdated = await saveSettings();
    }
    
    // 3. Salva i turni e aggiorna la dashboard
    await saveShifts();
    closeModal('payslipModal');
    document.getElementById('payslipForm').reset();
    updateDashboard();
    
    // Se la vista attiva è il riepilogo, aggiornala
    if (document.getElementById('summaryView').classList.contains('active')) {
        updateSummaryView();
    }
    
    let message = 'Busta paga registrata con successo! Le ore di contratto del mese sono state segnate come pagate.';
    if (rateUpdated) {
        message += ` La tariffa oraria contrattuale è stata aggiornata a €${userSettings.contractRate.toFixed(2)}/h.`;
    }
    alert(message);
}