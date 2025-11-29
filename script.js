// Global state
let currentUser = null;
let userSettings = null;
let shifts = [];
let activeShift = null;
let currentCalendarDate = new Date();
let weeklyChart = null;

// Base URL for API calls
const API_BASE = 'https://matteon20.sg-host.com/api/';

// Default iniziale per la tariffa oraria
const CONTRACT_RATE_DEFAULT = 300 / 32.4;

// ----------------------------------------------------
// HELPER PER GESTIONE DATE E FUSO ORARIO (NUOVE FUNZIONI)
// ----------------------------------------------------

/**
 * Funzione sicura per ottenere la data in formato 'YYYY-MM-DD' senza errori di fuso orario UTC.
 * Utilizza i metodi locali dell'oggetto Date.
 * @param {Date} d - L'oggetto Date da formattare.
 * @returns {string} La data formattata (e.g., '2025-11-29').
 */
function getLocalISODate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    // Check for active shift in localStorage
    const savedActiveShift = localStorage.getItem('activeShift');
    if (savedActiveShift) {
        activeShift = JSON.parse(savedActiveShift);
        updateActiveShiftDisplay();
        startActiveShiftTimer();
    }
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
    
    // Calendar controls
    document.getElementById('startShiftBtn').addEventListener('click', startShift);
    document.getElementById('endShiftBtn').addEventListener('click', endShift);
    document.getElementById('addShiftBtn').addEventListener('click', () => showShiftForm());
    document.getElementById('prevMonthBtn').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    
    document.getElementById('shiftFormElement').addEventListener('submit', handleSaveShift);
    document.getElementById('cancelShiftBtn').addEventListener('click', hideShiftForm);
    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
    document.getElementById('passwordForm').addEventListener('submit', handleChangePassword);
    document.getElementById('deleteProfileBtn').addEventListener('click', handleDeleteProfile);
    document.getElementById('registerPayslipBtn').addEventListener('click', showPayslipModal);
    document.getElementById('payslipForm').addEventListener('submit', handlePayslipSubmit);
    
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', updateSummaryView);
    }
}

// Active Shift Management
function startShift() {
    const now = new Date();
    activeShift = {
        startTime: now.toISOString(),
        startDisplay: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    };
    localStorage.setItem('activeShift', JSON.stringify(activeShift));
    
    document.getElementById('startShiftBtn').style.display = 'none';
    document.getElementById('endShiftBtn').style.display = 'inline-flex';
    document.getElementById('activeShiftIndicator').style.display = 'block';
    
    updateActiveShiftDisplay();
    startActiveShiftTimer();
}

function endShift() {
    if (!activeShift) return;
    
    const endTime = new Date();
    const startTime = new Date(activeShift.startTime);
    
    // Pre-fill the form with active shift data
    // Usa la funzione sicura per la data
    document.getElementById('shiftDate').value = getLocalISODate(startTime); 
    document.getElementById('shiftStart').value = startTime.toTimeString().slice(0, 5);
    document.getElementById('shiftEnd').value = endTime.toTimeString().slice(0, 5);
    
    // Clear active shift
    activeShift = null;
    localStorage.removeItem('activeShift');
    
    document.getElementById('startShiftBtn').style.display = 'inline-flex';
    document.getElementById('endShiftBtn').style.display = 'none';
    document.getElementById('activeShiftIndicator').style.display = 'none';
    
    // Show form to save the shift
    showShiftForm();
    alert('Turno terminato! Compila i dettagli e salva.');
}

function updateActiveShiftDisplay() {
    if (!activeShift) return;
    
    document.getElementById('activeShiftStartTime').textContent = activeShift.startDisplay;
    calculateActiveShiftDuration();
}

function startActiveShiftTimer() {
    // Update duration every minute
    setInterval(() => {
        if (activeShift) {
            calculateActiveShiftDuration();
        }
    }, 60000); // Every 60 seconds
    
    // Initial update
    calculateActiveShiftDuration();
}

function calculateActiveShiftDuration() {
    if (!activeShift) return;
    
    const now = new Date();
    const start = new Date(activeShift.startTime);
    const diffMs = now - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    document.getElementById('activeShiftDuration').textContent = `${hours}h ${minutes}m`;
}

// Calendar Functions
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month/year label
    const monthName = currentCalendarDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthYear').textContent = 
        monthName.charAt(0).toUpperCase() + monthName.slice(1);
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    
    // Get previous month's last days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    let html = '<div class="calendar-header">';
    ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(day => {
        html += `<div class="calendar-day-name">${day}</div>`;
    });
    html += '</div><div class="calendar-days">';
    
    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const date = new Date(year, month - 1, day);
        html += renderCalendarDay(date, true);
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        html += renderCalendarDay(date, false);
    }
    
    // Next month days
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        html += renderCalendarDay(date, true);
    }
    
    html += '</div>';
    calendar.innerHTML = html;
}

function renderCalendarDay(date, isOtherMonth) {
    // FIX: Usa la funzione sicura getLocalISODate per evitare il disallineamento di un giorno
    const dateStr = getLocalISODate(date); 
    const today = getLocalISODate(new Date()); // FIX: Corretta evidenziazione di "oggi"
    
    const dayShifts = shifts.filter(s => s.date === dateStr);
    
    let classes = 'calendar-day';
    if (isOtherMonth) classes += ' other-month';
    if (dateStr === today) classes += ' today';
    
    let html = `<div class="${classes}" onclick="showDayDetail('${dateStr}')">`;
    html += `<div class="calendar-day-number">${date.getDate()}</div>`;
    
    if (dayShifts.length > 0) {
        html += '<div class="calendar-shifts">';
        const maxVisible = 2;
        dayShifts.slice(0, maxVisible).forEach(shift => {
            const type = getShiftType(shift);
            const hours = calculateHours(shift.start, shift.end);
            html += `<div class="calendar-shift-item ${type}">${shift.start} - ${shift.end} (${hours.toFixed(1)}h)</div>`;
        });
        if (dayShifts.length > maxVisible) {
            html += `<div class="calendar-shift-more">+${dayShifts.length - maxVisible} altro/i</div>`;
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function changeCalendarMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

let selectedDayForShift = null;

function showDayDetail(dateStr) {
    selectedDayForShift = dateStr;
    // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
    const date = new Date(dateStr + 'T00:00:00'); 
    const formattedDate = date.toLocaleDateString('it-IT', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    document.getElementById('dayDetailTitle').textContent = 
        formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const container = document.getElementById('dayDetailShifts');
    
    if (dayShifts.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessun turno programmato per questo giorno</p>';
    } else {
        container.innerHTML = '';
        dayShifts.forEach(shift => {
            const originalIndex = shifts.indexOf(shift);
            const type = getShiftType(shift);
            const hours = calculateHours(shift.start, shift.end);
            const typeLabel = type === 'extra' ? 'Extra' : 'Contratto';
            
            const div = document.createElement('div');
            div.className = `day-shift-item ${type}`;
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">
                            ${shift.start} - ${shift.end}
                            <span class="shift-badge ${type}">${typeLabel}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-light);">
                            ${hours.toFixed(1)} ore
                        </div>
                        ${shift.notes ? `<div style="font-size: 13px; margin-top: 4px;">${shift.notes}</div>` : ''}
                    </div>
                    <div class="shift-actions">
                        <button class="icon-btn" onclick="editShiftFromDay(${originalIndex})" title="Modifica">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                        </button>
                        <button class="icon-btn" onclick="deleteShiftFromDay(${originalIndex})" title="Elimina">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }
    
    document.getElementById('dayDetailModal').classList.add('active');
}

function closeDayDetail() {
    document.getElementById('dayDetailModal').classList.remove('active');
    selectedDayForShift = null;
}

function addShiftForDay() {
    if (selectedDayForShift) {
        document.getElementById('shiftDate').value = selectedDayForShift;
    }
    closeDayDetail();
    switchView('shifts');
    showShiftForm();
}

function editShiftFromDay(index) {
    closeDayDetail();
    switchView('shifts');
    showShiftForm(index);
}

async function deleteShiftFromDay(index) {
    if (confirm('Sei sicuro di voler eliminare questo turno?')) {
        shifts.splice(index, 1);
        await saveShifts();
        showDayDetail(selectedDayForShift); // Refresh the modal
        renderCalendar(); // Refresh the calendar
        updateDashboard();
        if (document.getElementById('summaryView').classList.contains('active')) {
            updateSummaryView();
        }
    }
}
// Dashboard Functions
function updateDashboard() {
    const now = new Date();
    const currentYear = now.getFullYear();
    // Usa getLocalISODate per la settimana
    const currentWeek = getWeekNumber(getLocalISODate(now)); 
    const currentMonth = now.getMonth();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const contractRate = userSettings?.contractRate || CONTRACT_RATE_DEFAULT;
    const extraRate = userSettings?.extraRate || 10;
    const weeklyHoursTarget = userSettings?.weeklyHours || 18;
    
    // Week Stats
    const weekStats = calculateWeeklyStats(currentYear, currentWeek);
    document.getElementById('weekHours').textContent = weekStats.totalHours.toFixed(1) + 'h';
    const weekProgress = (weekStats.totalHours / weeklyHoursTarget * 100).toFixed(0);
    document.getElementById('weekProgress').textContent = `${weekProgress}% dell'obiettivo`;
    
    // Month Stats
    const monthShifts = getMonthShifts(currentMonth, currentYear);
    let monthTotal = 0;
    monthShifts.forEach(s => monthTotal += calculateHours(s.start, s.end));
    document.getElementById('monthHours').textContent = monthTotal.toFixed(1) + 'h';
    
    // Month Comparison
    const prevMonthShifts = getMonthShifts(prevMonth, prevYear);
    let prevMonthTotal = 0;
    prevMonthShifts.forEach(s => prevMonthTotal += calculateHours(s.start, s.end));
    
    if (prevMonthTotal > 0) {
        const diff = monthTotal - prevMonthTotal;
        const diffText = diff >= 0 ? `+${diff.toFixed(1)}h` : `${diff.toFixed(1)}h`;
        const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
        document.getElementById('monthComparison').innerHTML = 
            `<span style="color: ${diffColor}">${diffText} vs mese scorso</span>`;
    } else {
        document.getElementById('monthComparison').textContent = 'Primo mese';
    }
    
    // Earnings
    const monthStats = calculateMonthlyStats(currentMonth, currentYear);
    const contractEarnings = monthStats.contractHours * contractRate;
    const extraEarnings = monthStats.extraHours * extraRate;
    
    document.getElementById('contractEarnings').textContent = '€' + contractEarnings.toFixed(2);
    document.getElementById('extraEarnings').textContent = '€' + extraEarnings.toFixed(2);
    
    // Payment Status (Cumulative)
    let paidContract = 0, pendingContract = 0, paidExtra = 0, pendingExtra = 0;
    const weeklyContract = userSettings?.weeklyHours || 18;
    const weekContractUsed = new Map();
    
    // CORREZIONE FUSO ORARIO: Assicura un corretto sorting basato sulla data locale
    const allSortedShifts = [...shifts].sort((a, b) => 
        new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00')
    );
    
    allSortedShifts.forEach(shift => {
        // CORREZIONE FUSO ORARIO: Assicura che la data sia interpretata localmente
        const shiftDate = new Date(shift.date + 'T00:00:00'); 
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
        
        const contractEarningsSegment = allocatedContract * contractRate;
        if (shift.status === 'paid') paidContract += contractEarningsSegment;
        else pendingContract += contractEarningsSegment;
        
        const extraEarningsSegment = allocatedExtra * extraRate;
        if (shift.status === 'paid') paidExtra += extraEarningsSegment;
        else pendingExtra += extraEarningsSegment;
    });
    
    document.getElementById('paidContract').textContent = '€' + paidContract.toFixed(2);
    document.getElementById('pendingContract').textContent = '€' + pendingContract.toFixed(2);
    document.getElementById('paidExtra').textContent = '€' + paidExtra.toFixed(2);
    document.getElementById('pendingExtra').textContent = '€' + pendingExtra.toFixed(2);
    
    // Update other dashboard sections
    updateUpcomingShifts();
    updateWeeklyChart();
}

function updateUpcomingShifts() {
    const container = document.getElementById('upcomingShifts');
    const today = new Date();
    // Usa la funzione sicura per oggi
    const todayStr = getLocalISODate(today);
    
    // CORREZIONE FUSO ORARIO: Assicura un corretto filtro e sorting per la data locale
    const upcomingShifts = shifts
        .filter(s => s.date >= todayStr)
        .sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'))
        .slice(0, 5);
    
    if (upcomingShifts.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessun turno programmato</p>';
        return;
    }
    
    container.innerHTML = '';
    upcomingShifts.forEach(shift => {
        const type = getShiftType(shift);
        const hours = calculateHours(shift.start, shift.end);
        // CORREZIONE FUSO ORARIO: Assicura che la data sia interpretata localmente per la formattazione
        const date = new Date(shift.date + 'T00:00:00'); 
        const formattedDate = date.toLocaleDateString('it-IT', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
        });
        
        const div = document.createElement('div');
        div.className = `upcoming-shift-card ${type}`;
        div.innerHTML = `
            <div class="upcoming-shift-info">
                <div class="upcoming-shift-date">${formattedDate}</div>
                <div class="upcoming-shift-time">${shift.start} - ${shift.end}</div>
                ${shift.notes ? `<div style="font-size: 12px; color: var(--text-light); margin-top: 2px;">${shift.notes}</div>` : ''}
            </div>
            <div class="upcoming-shift-hours">${hours.toFixed(1)}h</div>
        `;
        container.appendChild(div);
    });
}

function updateWeeklyChart() {
    const canvas = document.getElementById('weeklyChart');
    const ctx = canvas.getContext('2d');
    
    // Get last 4 weeks
    const today = new Date();
    const weeks = [];
    const weekLabels = [];
    const weekData = [];
    const weeklyTarget = userSettings?.weeklyHours || 18;
    
    for (let i = 3; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (i * 7));
        const year = date.getFullYear();
        // Nota: getWeekNumber usa la correzione interna, passiamo una stringa di data locale
        const week = getWeekNumber(getLocalISODate(date)); 
        
        const stats = calculateWeeklyStats(year, week);
        weekData.push(stats.totalHours);
        
        // Label: "Sett. 45"
        weekLabels.push(`Sett. ${week}`);
    }
    
    // Destroy previous chart if exists
    if (weeklyChart) {
        weeklyChart.destroy();
    }
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekLabels,
            datasets: [{
                label: 'Ore Lavorate',
                data: weekData,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2
            }, {
                label: 'Obiettivo Settimanale',
                data: weekLabels.map(() => weeklyTarget),
                type: 'line',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ore'
                    }
                }
            }
        }
    });
}

// Helper Functions 
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
    if (viewName === 'shifts') renderCalendar();
    if (viewName === 'settings') loadSettings();
    if (viewName === 'summary') updateSummaryView();
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
        activeShift = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('activeShift');
        showScreen('loginScreen');
        document.getElementById('loginForm').reset();
    }
}

async function loadUserData() {
    try {
        const settingsResponse = await fetch(API_BASE + `get_settings.php?username=${currentUser}`, {method: 'GET'});
        userSettings = await settingsResponse.json();
        
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
        if (parts.length >= 5) {
            data.push({
                date: parts[0],
                start: parts[1],
                end: parts[2],
                notes: parts[3],
                status: parts[4]
            });
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
    // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
    const d = new Date(dateStr + 'T00:00:00'); 
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isShiftExtra(shiftDate) {
    if (!userSettings || !userSettings.contractStartDate) return false;
    // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
    const contractStart = new Date(userSettings.contractStartDate + 'T00:00:00'); 
    // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
    const shift = new Date(shiftDate + 'T00:00:00'); 
    return shift < contractStart;
}

function getShiftType(shift) {
    if (isShiftExtra(shift.date)) return 'extra';

    const weeklyContract = userSettings?.weeklyHours || 18;
    const week = getWeekNumber(shift.date);
    
    const weekShifts = shifts
        .filter(s => getWeekNumber(s.date) === week && !isShiftExtra(s.date))
        // CORREZIONE FUSO ORARIO: Assicura un corretto sorting per la data locale
        .sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));
    
    let usedContract = 0;

    for (const s of weekShifts) {
        const hours = calculateHours(s.start, s.end);
        const remainingContract = Math.max(0, weeklyContract - usedContract);
        const allocatedContract = Math.min(hours, remainingContract);
        
        if (s.date === shift.date && s.start === shift.start && s.end === shift.end) {
            return allocatedContract > 0 ? 'contract' : 'extra';
        }
        
        usedContract += allocatedContract;
    }
    return 'contract';
}

function getMonthShifts(month, year) {
    return shifts.filter(s => {
        // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
        const d = new Date(s.date + 'T00:00:00'); 
        return d.getMonth() === month && d.getFullYear() === year;
    });
}

function calculateWeeklyStats(year, week) {
    const weekShifts = shifts.filter(s => {
        // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
        const d = new Date(s.date + 'T00:00:00'); 
        return d.getFullYear() === year && getWeekNumber(s.date) === week;
    });
    
    let totalHours = 0;
    weekShifts.forEach(s => {
        totalHours += calculateHours(s.start, s.end);
    });
    
    return { totalHours };
}

function calculateMonthlyStats(month, year) {
    let contractHours = 0;
    let extraHours = 0;
    const weeklyContract = userSettings?.weeklyHours || 18;
    const weekContractUsed = new Map();

    // CORREZIONE FUSO ORARIO: Assicura un corretto sorting per la data locale
    const allSortedShifts = [...shifts].sort((a, b) => 
        new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00')
    );

    allSortedShifts.forEach(shift => {
        // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
        const shiftDate = new Date(shift.date + 'T00:00:00');
        const shiftMonth = shiftDate.getMonth();
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

        if (shiftMonth === month && shiftYear === year) {
            contractHours += allocatedContract;
            extraHours += allocatedExtra;
        }
    });

    return { contractHours, extraHours };
}

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
        
        // If selectedDayForShift is set, pre-fill date
        if (selectedDayForShift) {
            document.getElementById('shiftDate').value = selectedDayForShift;
        } else {
            document.getElementById('shiftDate').value = getLocalISODate(new Date());
        }
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
    
    // CORREZIONE FUSO ORARIO: Assicura un corretto sorting per la data locale
    shifts.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
    await saveShifts();
    hideShiftForm();
    renderCalendar();
    updateDashboard();
    
    if (document.getElementById('summaryView').classList.contains('active')) {
        updateSummaryView();
    }
}

async function deleteShift(index) {
    if (confirm('Sei sicuro di voler eliminare questo turno?')) {
        shifts.splice(index, 1);
        await saveShifts();
        renderCalendar();
        updateDashboard();
        if (document.getElementById('summaryView').classList.contains('active')) {
            updateSummaryView();
        }
    }
}

async function toggleShiftStatus(index) {
    shifts[index].status = shifts[index].status === 'paid' ? 'pending' : 'paid';
    await saveShifts();
    renderCalendar();
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
    // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
    const d = new Date(dateStr + 'T00:00:00'); 
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function updateSummaryView() {
    const summaryTotalHoursEl = document.getElementById('summaryTotalHours');
    if (!summaryTotalHoursEl) {
        return;
    }
    
    const monthFilter = document.getElementById('monthFilter').value;
    let shiftsToAnalyze = shifts;
    
    let currentFilterYear, currentFilterMonth;
    
    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        currentFilterYear = year;
        currentFilterMonth = month - 1;
        shiftsToAnalyze = getMonthShifts(currentFilterMonth, currentFilterYear);
    }
    
    const totalHours = shiftsToAnalyze.reduce((acc, shift) => acc + calculateHours(shift.start, shift.end), 0);
    
    let contractHours = 0;
    let extraHours = 0;
    
    if (monthFilter) {
        const monthStats = calculateMonthlyStats(currentFilterMonth, currentFilterYear);
        contractHours = monthStats.contractHours;
        extraHours = monthStats.extraHours;
    } else {
        const weeklyContract = userSettings?.weeklyHours || 18;
        const weekContractUsed = new Map();
        
        // CORREZIONE FUSO ORARIO: Assicura un corretto sorting per la data locale
        const allSortedShifts = [...shifts].sort((a, b) => 
            new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00')
        );
        
        allSortedShifts.forEach(shift => {
            // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
            const shiftDate = new Date(shift.date + 'T00:00:00');
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
            
            contractHours += allocatedContract;
            extraHours += allocatedExtra;
        });
    }

    const contractRate = userSettings?.contractRate || CONTRACT_RATE_DEFAULT;
    const extraRate = userSettings?.extraRate || 10;

    const contractEarnings = contractHours * contractRate;
    const extraEarnings = extraHours * extraRate;
    const totalEarnings = contractEarnings + extraEarnings;
    
    summaryTotalHoursEl.textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('summaryContractHours').textContent = contractHours.toFixed(1) + 'h';
    document.getElementById('summaryContractEarnings').textContent = '(€' + contractEarnings.toFixed(2) + ')';
    document.getElementById('summaryExtraHours').textContent = extraHours.toFixed(1) + 'h';
    document.getElementById('summaryExtraEarnings').textContent = '(€' + extraEarnings.toFixed(2) + ')';
    document.getElementById('summaryTotalEarnings').textContent = '€' + totalEarnings.toFixed(2);
    
    const tbody = document.getElementById('summaryTableBody');
    
    if (!tbody) {
        console.error("Errore: Elemento <tbody> con ID 'summaryTableBody' non trovato nel DOM.");
        return;
    }
    
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
    
    if (document.getElementById('monthFilter') && document.getElementById('monthFilter').options.length === 1) {
        populateMonthFilter();
    }
}

function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    if (!select) return;
    
    const months = new Set();
    
    shifts.forEach(shift => {
        // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
        const d = new Date(shift.date + 'T00:00:00'); 
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
    
    const existingContractRate = userSettings?.contractRate;
    
    userSettings = {
        contractStartDate: document.getElementById('contractStartDate').value,
        weeklyHours: parseFloat(document.getElementById('weeklyHours').value),
        extraRate: parseFloat(document.getElementById('extraRate').value),
        contractRate: existingContractRate || CONTRACT_RATE_DEFAULT
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
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const value = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        select.appendChild(option);
    }
    
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
    const [year, month] = monthValue.split('-').map(Number);
    
    const payslipHours = parseFloat(document.getElementById('payslipHours').value);
    const payslipAmount = parseFloat(document.getElementById('payslipAmount').value);
    
    shifts.forEach(shift => {
        // CORREZIONE FUSO ORARIO: Aggiunge T00:00:00 per interpretare la data come locale
        const d = new Date(shift.date + 'T00:00:00'); 
        if (d.getFullYear() === year && d.getMonth() === month && !isShiftExtra(shift.date)) {
            shift.status = 'paid';
        }
    });
    
    let rateUpdated = false;
    if (payslipHours > 0 && payslipAmount >= 0) {
        const newRate = payslipAmount / payslipHours;
        userSettings.contractRate = newRate;
        rateUpdated = await saveSettings();
    }
    
    await saveShifts();
    closeModal('payslipModal');
    document.getElementById('payslipForm').reset();
    updateDashboard();
    
    if (document.getElementById('summaryView').classList.contains('active')) {
        updateSummaryView();
    }
    
    let message = 'Busta paga registrata con successo! Le ore di contratto del mese sono state segnate come pagate.';
    if (rateUpdated) {
        message += ` La tariffa oraria contrattuale è stata aggiornata a €${userSettings.contractRate.toFixed(2)}/h.`;
    }
    alert(message);
}