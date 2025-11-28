// Global state
let currentUser = null;
let userSettings = null;
let shifts = [];

// Base URL for API calls - usa il percorso completo del tuo sito
const API_BASE = 'https://matteon20.sg-host.com/api/';

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
    document.getElementById('monthFilter').addEventListener('change', updateSummaryView);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(i => i.classList.remove('active'));
    document.getElementById(viewName + 'View').classList.add('active');
    document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');
    
    if (viewName === 'dashboard') updateDashboard();
    if (viewName === 'shifts') updateShiftsList();
    if (viewName === 'summary') updateSummaryView();
    if (viewName === 'settings') loadSettings();
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

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isShiftExtra(shiftDate) {
    if (!userSettings || !userSettings.contractStartDate) return true;
    const contractStart = new Date(userSettings.contractStartDate);
    const shift = new Date(shiftDate);
    return shift < contractStart;
}

function getMonthShifts(month, year) {
    return shifts.filter(s => {
        const d = new Date(s.date);
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
    
    const weeklyContract = userSettings?.weeklyHours || 18;
    const contractHours = Math.min(totalHours, weeklyContract);
    const extraHours = Math.max(0, totalHours - weeklyContract);
    
    return { totalHours, contractHours, extraHours };
}

function calculateMonthlyStats(month, year) {
    const monthShifts = getMonthShifts(month, year);
    let contractHours = 0;
    let extraHours = 0;
    const weekMap = new Map();
    
    monthShifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        const week = getWeekNumber(shift.date);
        const key = `${shiftDate.getFullYear()}-${week}`;
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key).push(shift);
    });
    
    weekMap.forEach((weekShifts, key) => {
        const [year, week] = key.split('-');
        const allWeekShifts = shifts.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === parseInt(year) && getWeekNumber(s.date) === parseInt(week);
        });
        
        let weekTotal = 0;
        allWeekShifts.forEach(s => weekTotal += calculateHours(s.start, s.end));
        const weeklyContract = userSettings?.weeklyHours || 18;
        
        weekShifts.forEach(shift => {
            const shiftHours = calculateHours(shift.start, shift.end);
            if (isShiftExtra(shift.date)) {
                extraHours += shiftHours;
            } else {
                if (weekTotal <= weeklyContract) {
                    contractHours += shiftHours;
                } else {
                    const availableContract = Math.max(0, weeklyContract - (weekTotal - shiftHours));
                    contractHours += Math.min(shiftHours, availableContract);
                    extraHours += Math.max(0, shiftHours - availableContract);
                }
            }
        });
    });
    
    return { contractHours, extraHours };
}

function updateDashboard() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth();
    
    const weekStats = calculateWeeklyStats(currentYear, currentWeek);
    document.getElementById('weekHours').textContent = weekStats.totalHours.toFixed(1) + 'h';
    
    const monthShifts = getMonthShifts(currentMonth, currentYear);
    let monthTotal = 0;
    monthShifts.forEach(s => monthTotal += calculateHours(s.start, s.end));
    document.getElementById('monthHours').textContent = monthTotal.toFixed(1) + 'h';
    
    const monthStats = calculateMonthlyStats(currentMonth, currentYear);
    const extraRate = userSettings?.extraRate || 10;
    const contractEarnings = monthStats.contractHours * (300 / 32.4);
    const extraEarnings = monthStats.extraHours * extraRate;
    
    document.getElementById('contractEarnings').textContent = '€' + contractEarnings.toFixed(2);
    document.getElementById('extraEarnings').textContent = '€' + extraEarnings.toFixed(2);
    
    let paidContract = 0, pendingContract = 0, paidExtra = 0, pendingExtra = 0;
    
    monthShifts.forEach(shift => {
        const hours = calculateHours(shift.start, shift.end);
        const isExtra = isShiftExtra(shift.date);
        const earnings = isExtra ? hours * extraRate : hours * (300 / 32.4);
        
        if (shift.status === 'paid') {
            if (isExtra) paidExtra += earnings;
            else paidContract += earnings;
        } else {
            if (isExtra) pendingExtra += earnings;
            else pendingContract += earnings;
        }
    });
    
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
}

async function deleteShift(index) {
    if (confirm('Sei sicuro di voler eliminare questo turno?')) {
        shifts.splice(index, 1);
        await saveShifts();
        updateShiftsList();
        updateDashboard();
    }
}

async function toggleShiftStatus(index) {
    shifts[index].status = shifts[index].status === 'paid' ? 'pending' : 'paid';
    await saveShifts();
    updateShiftsList();
    updateDashboard();
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
        const isExtra = isShiftExtra(shift.date);
        const type = isExtra ? 'extra' : 'contract';
        const typeLabel = isExtra ? 'Extra' : 'Contratto';
        const statusLabel = shift.status === 'paid' ? 'Pagato' : 'Da pagare';
        
        const item = document.createElement('div');
        item.className = 'shift-item';
        item.innerHTML = `
            <div class="shift-info">
                <div class="shift-date">${formatDate(shift.date)}</div>
                <div class="shift-time">${shift.start} - ${shift.end}</div>
                <div class="shift-hours">${hours.toFixed(1)}h 
                    <span class="shift-badge ${type}">${typeLabel}</span>
                    ${isExtra ? `<span class="shift-badge ${shift.status}">${statusLabel}</span>` : ''}
                </div>
                ${shift.notes ? `<div class="shift-notes">${shift.notes}</div>` : ''}
            </div>
            <div class="shift-actions">
                <button class="icon-btn" onclick="showShiftForm(${index})" title="Modifica">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                </button>
                ${isExtra ? `
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
    const monthFilter = document.getElementById('monthFilter').value;
    let filteredShifts = shifts;
    
    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        filteredShifts = getMonthShifts(month - 1, year);
    }
    
    let totalHours = 0, contractHours = 0, extraHours = 0;
    
    filteredShifts.forEach(shift => {
        const hours = calculateHours(shift.start, shift.end);
        totalHours += hours;
        if (isShiftExtra(shift.date)) {
            extraHours += hours;
        } else {
            contractHours += hours;
        }
    });
    
    const extraRate = userSettings?.extraRate || 10;
    const totalEarnings = (contractHours * (300 / 32.4)) + (extraHours * extraRate);
    
    document.getElementById('summaryTotalHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('summaryContractHours').textContent = contractHours.toFixed(1) + 'h';
    document.getElementById('summaryExtraHours').textContent = extraHours.toFixed(1) + 'h';
    document.getElementById('summaryTotalEarnings').textContent = '€' + totalEarnings.toFixed(2);
    
    const tbody = document.getElementById('summaryTableBody');
    
    if (filteredShifts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nessun turno da visualizzare</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    filteredShifts.forEach((shift) => {
        const hours = calculateHours(shift.start, shift.end);
        const isExtra = isShiftExtra(shift.date);
        const type = isExtra ? 'Extra' : 'Contratto';
        const status = shift.status === 'paid' ? 'Pagato' : 'Da pagare';
        const originalIndex = shifts.indexOf(shift);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(shift.date)}</td>
            <td>${shift.start}</td>
            <td>${shift.end}</td>
            <td>${hours.toFixed(1)}h</td>
            <td><span class="shift-badge ${isExtra ? 'extra' : 'contract'}">${type}</span></td>
            <td><span class="shift-badge ${shift.status}">${status}</span></td>
            <td>${shift.notes}</td>
            <td>
                <div class="shift-actions">
                    <button class="icon-btn" onclick="showShiftForm(${originalIndex}); switchView('shifts');" title="Modifica">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                    </button>
                    ${isExtra ? `
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
    
    if (document.getElementById('monthFilter').options.length === 1) {
        populateMonthFilter();
    }
}

function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    const months = new Set();
    
    shifts.forEach(shift => {
        const d = new Date(shift.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(key);
    });
    
    const sortedMonths = Array.from(months).sort().reverse();
    
    sortedMonths.forEach(month => {
        const [year, m] = month.split('-');
        const date = new Date(year, parseInt(m) - 1);
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        select.appendChild(option);
    });
}

function loadSettings() {
    if (userSettings) {
        document.getElementById('contractStartDate').value = userSettings.contractStartDate || '2024-10-21';
        document.getElementById('weeklyHours').value = userSettings.weeklyHours || 18;
        document.getElementById('extraRate').value = userSettings.extraRate || 10;
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    userSettings = {
        contractStartDate: document.getElementById('contractStartDate').value,
        weeklyHours: parseFloat(document.getElementById('weeklyHours').value),
        extraRate: parseFloat(document.getElementById('extraRate').value)
    };
    
    try {
        const response = await fetch(API_BASE + 'save_settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, settings: userSettings })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Impostazioni salvate con successo!');
            updateDashboard();
        } else {
            alert('Errore durante il salvataggio');
        }
    } catch (error) {
        console.error('Save settings error:', error);
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
    
    for (let i = 1; i <= 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const value = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        select.appendChild(option);
    }
    
    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function handlePayslipSubmit(e) {
    e.preventDefault();
    
    const monthValue = document.getElementById('payslipMonth').value;
    const [year, month] = monthValue.split('-').map(Number);
    
    shifts.forEach(shift => {
        const d = new Date(shift.date);
        if (d.getFullYear() === year && d.getMonth() === month && !isShiftExtra(shift.date)) {
            shift.status = 'paid';
        }
    });
    
    await saveShifts();
    closeModal('payslipModal');
    document.getElementById('payslipForm').reset();
    updateDashboard();
    alert('Busta paga registrata con successo!');
}