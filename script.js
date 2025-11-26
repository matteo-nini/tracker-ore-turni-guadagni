// --- CONSTANTI E STATO GLOBALE ---
// Rimosso PROFILES perché è già importato da profiles.js
let currentProfileId = null;
let isLoggedIn = false; // Stato di protezione

let shifts = []; // Array RAW dei turni (Data, Entrata, Uscita, Note)
let SETTINGS = {
    // Valori predefiniti per un nuovo profilo
    CONTRACT_START: new Date().toISOString().split('T')[0],
    WEEKLY_HOURS: 18,
    OCTOBER_HOURS: 32.4, // Ore di riferimento da busta paga
    OCTOBER_PAYOUT: 300, // Paga netta di riferimento da busta paga
    EXTRA_RATE: 10,
    EXTRA_PAID: 0 // Nuovo campo: già pagato sugli extra
};

// --- CONFIGURAZIONE SERVER ---
const PROFILES_FILE_PATH = 'profiles/profiles.json';
const MANAGE_PROFILES_SCRIPT_PATH = 'php/manage_profiles.php';
const SAVE_SHIFTS_SCRIPT_PATH = 'php/save_shifts.php';
const SAVE_SETTINGS_SCRIPT_PATH = 'php/save_settings.php';

let detailView = 'month';
let selectedDetailMonth = 'current';

// --- INIZIALIZZAZIONE e GESTIONE PROFILI ---

async function initializeApp() {
    await loadProfilesList();
    
    const urlParams = new URLSearchParams(window.location.search);
    const profileParam = urlParams.get('profile');

    if (profileParam && PROFILES.some(p => p.id === profileParam)) {
        currentProfileId = profileParam;
        document.getElementById('profileSelector').value = currentProfileId;
        // Al caricamento, apri subito il modal di login
        openLoginModal(false); 
    } else if (PROFILES.length > 0) {
        // Se c'è almeno un profilo, impostalo come predefinito e chiedi il login
        currentProfileId = PROFILES[0].id;
        document.getElementById('profileSelector').value = currentProfileId;
        openLoginModal(false); 
    } else {
        // Nessun profilo, apri il modal di creazione
        openCreateProfileModal(true);
    }
    
    // Carica i dati e aggiorna la UI, che applicherà l'oscuramento se non loggato
    await loadAllData(); 
    
    toggleDataObfuscation(!isLoggedIn);
    // Imposta lo stato 'pagato' per i turni contrattuali di ottobre, 'da pagare' per gli extra
    const ottobreKey = '2025-10';
    const processedShifts = getProcessedShifts();
    shifts.forEach((shift, idx) => {
        if (shift.date.startsWith(ottobreKey)) {
            const proc = processedShifts.find(s => s.date === shift.date && s.start === shift.start && s.end === shift.end && s.notes === shift.notes);
            if (proc) {
                if (proc.contractHours > 0) {
                    shift.status = 'pagato'; // Contrattuali pagati
                } else if (proc.extraHours > 0) {
                    shift.status = 'da pagare'; // Extra da pagare
                } else {
                    shift.status = 'da pagare'; // Default
                }
            }
        }
    });
    autoSaveShiftsToServer();
}

// Funzione per oscurare/mostrare i dati nel body
function toggleDataObfuscation(obfuscate) {
    const body = document.body;
    if (obfuscate) {
        body.classList.add('data-obfuscated');
        // Nasconde esplicitamente la tabella e l'input turni
        document.querySelector('.table-section').style.display = 'none';
        document.querySelector('.input-section').style.display = 'none';
    } else {
        body.classList.remove('data-obfuscated');
        // Mostra esplicitamente la tabella e l'input turni
        document.querySelector('.table-section').style.display = '';
        document.querySelector('.input-section').style.display = '';
    }
}

async function loadProfilesList() {
    // Cache Busting per il file dei profili
    const cacheBusterUrl = `${PROFILES_FILE_PATH}?t=${new Date().getTime()}`;
    try {
        const response = await fetch(cacheBusterUrl);
        if (response.ok) {
            PROFILES = await response.json();
        } else if (response.status === 404) {
            PROFILES = [];
            console.warn('File profiles.json non trovato. Inizia con un profilo nuovo.');
        }
    } catch (error) {
        console.error('Errore nel caricamento della lista profili:', error);
        PROFILES = [];
    }
    populateProfileSelector();
}

function populateProfileSelector() {
    const selector = document.getElementById('profileSelector');
    selector.innerHTML = '';
    if (!PROFILES || PROFILES.length === 0) {
        selector.innerHTML = '<option value="">Nessun Profilo</option>';
        return;
    }
    PROFILES.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name + (currentProfileId === p.id && isLoggedIn ? "" : " (offline)"); 
        selector.appendChild(option);
    });
    // Seleziona il profilo corrente dopo aver popolato
    if (currentProfileId) {
        selector.value = currentProfileId;
    }
}

function saveProfilesList() {
    fetch(MANAGE_PROFILES_SCRIPT_PATH, {
        method: 'POST',
        body: JSON.stringify(PROFILES),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (!response.ok) throw new Error('Errore salvataggio lista profili');
        console.log('Lista profili salvata.');
    }).catch(error => console.error(error.message));
}

function changeProfile() {
    const newProfileId = document.getElementById('profileSelector').value;
    if (newProfileId && newProfileId !== currentProfileId) {
        // Reindirizza forzando il login
        window.location.href = `?profile=${newProfileId}`;
    } else {
        closeModal('loginModal');
    }
}

// --- Funzioni di Sicurezza (PIN) ---
        
function sanitizeId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Simula un hash semplice (solo per confronto client-side)
function simpleHash(pin) {
    return 'PKEY-' + String(pin).trim() + '-XYZ';
}

function openLoginModal(isSwitch = true) {
    const selectedId = document.getElementById('profileSelector').value;
    const profile = PROFILES.find(p => p.id === selectedId);

    if (!profile) return;
    
    // Se siamo già loggati sul profilo corretto, chiudi il modal
    if (currentProfileId === selectedId && isLoggedIn) {
        closeModal('loginModal');
        return;
    }

    document.getElementById('loginMessage').textContent = `Accedi al profilo ${profile.name}`;
    document.getElementById('loginPIN').value = '';
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginPIN').focus();

    document.getElementById('tempProfileId').value = selectedId;

    // Aggiungi event listener per Enter
    const pinInput = document.getElementById('loginPIN');
    // Rimuovi eventuali listener precedenti
    pinInput.onkeydown = function(e) {
        if (e.key === 'Enter') {
            attemptLogin();
        }
    };
}

function attemptLogin() {
    const inputPIN = document.getElementById('loginPIN').value;
    const selectedId = document.getElementById('tempProfileId').value;
    const profile = PROFILES.find(p => p.id === selectedId);

    if (!profile) return;
    
    if (simpleHash(inputPIN) === profile.passwordHash) {
        isLoggedIn = true;
        currentProfileId = selectedId;
        closeModal('loginModal');
        // Rimuove l'oscuramento dopo il login
        toggleDataObfuscation(false);
        populateProfileSelector(); // Mostra lo stato di connessione
        loadAllData(); // Ricarica i dati con le credenziali corrette e aggiorna dashboard
    } else {
        document.getElementById('loginMessage').textContent = 'PIN errato. Riprova.';
        document.getElementById('loginPIN').value = '';
    }
}

function openCreateProfileModal(isFirstProfile = false) {
    document.getElementById('newProfileName').value = '';
    document.getElementById('newProfilePin').value = '';
    document.getElementById('newProfileMessage').textContent = isFirstProfile ? 'Crea il primo profilo per iniziare.' : 'Inserisci nome e PIN (numerico) per il nuovo profilo.';
    document.getElementById('createProfileModal').style.display = 'flex';
}

async function createNewProfile() {
    const name = document.getElementById('newProfileName').value.trim();
    const pin = document.getElementById('newProfilePin').value.trim();
    const message = document.getElementById('newProfileMessage');

    if (name.length < 2) {
        message.textContent = 'Il nome è troppo corto.';
        return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
        message.textContent = 'Il PIN deve essere un numero di 4-6 cifre.';
        return;
    }

    const id = sanitizeId(name);
    if (PROFILES.some(p => p.id === id)) {
        message.textContent = `Esiste già un profilo con ID ${id}. Cambia il nome.`;
        return;
    }
    
    // 1. Aggiungi il nuovo profilo
    const newProfile = {
        id: id,
        name: name,
        passwordHash: simpleHash(pin)
    };
    PROFILES.push(newProfile);
    saveProfilesList();

    // 2. Inizializza i file di settings per il nuovo profilo (con i valori di default)
    const defaultSettings = { ...SETTINGS };
    
    await fetch(`${SAVE_SETTINGS_SCRIPT_PATH}?profile=${id}`, {
        method: 'POST',
        body: JSON.stringify(defaultSettings),
        headers: { 'Content-Type': 'application/json' }
    });
    
    // 3. Ricarica la pagina sul nuovo profilo
    closeModal('createProfileModal');
    window.location.href = `?profile=${id}`;
}

// --- Funzioni Gestione Dati e Impostazioni ---

async function loadAllData() {
    await loadSettingsFromServer();
    await loadShiftsFromServer();
    updateDashboard(); // Forza aggiornamento dashboard dopo caricamento dati
}

async function loadShiftsFromServer() {
    const status = document.getElementById('saveStatus');
    status.textContent = 'Caricamento turni...';
    if (!currentProfileId) return;

    const CSV_FILE_PATH = `profiles/${currentProfileId}/shifts.csv`;
    // Cache Busting
    const cacheBusterUrl = `${CSV_FILE_PATH}?t=${new Date().getTime()}`;
    
    try {
        const response = await fetch(cacheBusterUrl);
        if (!response.ok) {
            if (response.status === 404) {
                shifts = [];
                status.textContent = `Nessun turno trovato per ${currentProfileId}. Pronto.`;
                return;
            }
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const csvText = await response.text();
        parseCSV(csvText);
        status.textContent = 'Turni caricati con successo.';
    } catch (error) {
        status.textContent = `Errore di caricamento turni: ${error.message}.`;
        shifts = [];
    } finally {
        populateMonthFilter();
        renderTable();
    }
}

// Rinominiamo la funzione per enfatizzare che viene chiamata in automatico
async function autoSaveShiftsToServer() {
    if (!isLoggedIn) {
        // Se non loggato, non permettere il salvataggio
        console.warn("Salvataggio bloccato: Utente non loggato.");
        return;
    }

    const status = document.getElementById('saveStatus');
    status.textContent = 'Salvataggio automatico in corso...';

    const csvData = generateCSV();
    const saveUrl = `${SAVE_SHIFTS_SCRIPT_PATH}?profile=${currentProfileId}`;

    try {
        const response = await fetch(saveUrl, {
            method: 'POST',
            body: csvData,
            headers: { 'Content-Type': 'text/csv' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Errore server: ${response.status} - ${errorText}`);
        }

        // Sostituito "✅ Salvato automaticamente!" con una classe e testo
        status.className = 'status-message success';
        status.textContent = 'Salvato automaticamente!';
        setTimeout(() => {
            status.textContent = 'Turni caricati con successo.';
            status.className = 'status-message';
        }, 3000);

    } catch (error) {
        // Sostituito "🚨 Errore di salvataggio" con una classe e testo
        status.className = 'status-message error';
        status.textContent = `Errore di salvataggio: ${error.message}`;
    }
}

async function loadSettingsFromServer() {
    if (!currentProfileId) return;
    const SETTINGS_FILE_PATH = `profiles/${currentProfileId}/settings.json`;
    const cacheBusterUrl = `${SETTINGS_FILE_PATH}?t=${new Date().getTime()}`;
    
    try {
        const response = await fetch(cacheBusterUrl);
        if (!response.ok) {
            if (response.status !== 404) {
                console.warn(`File impostazioni non trovato o errore HTTP ${response.status}. Uso impostazioni di default.`);
            }
            return; 
        }
        const jsonText = await response.text();
        const loadedSettings = JSON.parse(jsonText);
        
        SETTINGS = { ...SETTINGS, ...loadedSettings };

    } catch (error) {
        console.error('Errore nel caricamento del JSON delle impostazioni:', error);
    }
}

async function saveSettingsToServer() {
    if (!isLoggedIn) {
        alert("Devi effettuare l'accesso (PIN) per salvare le impostazioni.");
        return;
    }

    const status = document.getElementById('settingsSaveStatus');
    status.textContent = 'Salvataggio in corso...';

    const settingsJson = JSON.stringify(SETTINGS);
    const saveUrl = `${SAVE_SETTINGS_SCRIPT_PATH}?profile=${currentProfileId}`;

    try {
        const response = await fetch(saveUrl, {
            method: 'POST',
            body: settingsJson,
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Errore server: ${response.status} - ${errorText}`);
        }

        // Sostituito "💾 Impostazioni salvate!" con una classe e testo
        status.className = 'status-message success';
        status.textContent = 'Impostazioni salvate!';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status-message';
        }, 3000); 

    } catch (error) {
        // Sostituito "🚨 Errore di salvataggio" con una classe e testo
        status.className = 'status-message error';
        status.textContent = `Errore di salvataggio: ${error.message}`;
    }
}

// --- Funzioni Turni (add/delete/edit) ---

function parseCSV(csvText) {
    const normalizedText = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim() !== '');

    const newShifts = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split(',');
        // Ora si aspetta almeno 3 parti. Se ce ne sono 4 o 5, prende le ultime come notes e status.
        if (parts.length >= 3) {
            const [date, start, end, notes = '', status = 'da pagare'] = parts; 
            newShifts.push({
                date: date.trim(),
                start: start.trim(),
                end: end.trim(),
                notes: notes.trim(),
                status: status.trim() || 'da pagare'
            });
        } else {
            console.warn(`Riga CSV saltata o non valida: ${line}`);
        }
    }
    shifts = newShifts;
}

function generateCSV() {
    // Aggiorna l'intestazione per includere "Note" e "Stato"
    let csv = 'Data,Entrata,Uscita,Note,Stato\n'; 
    const sortedShifts = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedShifts.forEach(shift => {
        csv += `${shift.date},${shift.start},${shift.end},${shift.notes || ''},${shift.status || 'da pagare'}\n`; 
    });
    return csv;
}

function addShift() {
    if (!isLoggedIn) {
        alert("Devi effettuare l'accesso (PIN) per aggiungere un turno.");
        return;
    }
    const date = document.getElementById('newDate').value;
    const start = document.getElementById('newStart').value;
    const end = document.getElementById('newEnd').value;
    const notes = document.getElementById('newNotes').value; // NUOVO CAMPO

    if (!date || !start || !end) {
        alert('Compila data e orari!');
        return;
    }

    shifts.push({ date, start, end, notes, status: 'da pagare' }); // Include notes e stato
    
    document.getElementById('newDate').value = '';
    document.getElementById('newStart').value = '';
    document.getElementById('newEnd').value = '';
    document.getElementById('newNotes').value = ''; // Pulisce il campo note

    populateMonthFilter();
    renderTable();
    autoSaveShiftsToServer(); // Salvataggio automatico
}

function deleteShift(originalIndex) {
    if (!isLoggedIn) {
        alert("Devi effettuare l'accesso (PIN) per eliminare un turno.");
        return;
    }
    if (confirm('Sei sicuro di voler eliminare questo turno?')) {
        shifts.splice(originalIndex, 1);
        renderTable();
        autoSaveShiftsToServer(); // Salvataggio automatico
    }
}

function openEditModal(originalIndex) {
    if (!isLoggedIn) {
        alert("Devi effettuare l'accesso (PIN) per modificare un turno.");
        return;
    }
    const shiftToEdit = shifts[originalIndex];
    if (!shiftToEdit) {
        console.error('Turno non trovato per l\'indice:', originalIndex);
        return;
    }

    document.getElementById('editIndex').value = originalIndex;
    document.getElementById('editDate').value = shiftToEdit.date;
    document.getElementById('editStart').value = shiftToEdit.start;
    document.getElementById('editEnd').value = shiftToEdit.end;
    document.getElementById('editNotes').value = shiftToEdit.notes || ''; // NUOVO CAMPO

    document.getElementById('editModal').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function saveEdit() {
    const index = document.getElementById('editIndex').value;
    const date = document.getElementById('editDate').value;
    const start = document.getElementById('editStart').value;
    const end = document.getElementById('editEnd').value;
    const notes = document.getElementById('editNotes').value; // NUOVO CAMPO

    if (!date || !start || !end) {
        alert('Compila tutti i campi!');
        return;
    }

    shifts[index] = { date, start, end, notes }; // Salva notes

    closeModal('editModal');
    renderTable();
    autoSaveShiftsToServer(); // Salvataggio automatico
}

// --- Funzioni di Calcolo (ROBUSTO) ---

function calculateHours(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    // Gestione turno notturno
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
}

/**
 * Calcola il numero di settimana ISO 8601 (La settimana inizia di Lunedì).
 * @param {string} date - Data del turno (YYYY-MM-DD).
 * @returns {string} Chiave della settimana (YYYY-W##).
 */
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Imposta al giovedì della settimana per stabilire il numero di settimana
    d.setDate(d.getDate() + 4 - (d.getDay() || 7)); 
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Pre-elabora tutti i turni per assegnare in modo robusto le ore contrattuali ed extra
 * in base al limite settimanale e alla data di inizio contratto.
 * * @returns {Array<Object>} Lista dei turni con i campi calcolati (totalHours, contractHours, extraHours, earnings).
 */
function getProcessedShifts() {
    // 1. Ordina tutti i turni per data e ora di inizio
    const sortedShifts = [...shifts].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start.localeCompare(b.start);
    });

    const weeklyContractHoursUsed = {}; // Mappa per tenere traccia delle ore contrattuali usate { weekKey: hoursUsed }

    const contractStart = new Date(SETTINGS.CONTRACT_START);
    const contractHoursLimit = SETTINGS.WEEKLY_HOURS;
    const extraRate = SETTINGS.EXTRA_RATE;
    
    // Calcola il tasso orario contrattuale (es. 300€ / 32.4h)
    const contractRate = SETTINGS.OCTOBER_HOURS > 0 ? (SETTINGS.OCTOBER_PAYOUT / SETTINGS.OCTOBER_HOURS) : SETTINGS.EXTRA_RATE;


    // 2. Processa i turni in sequenza e calcola lo split
    return sortedShifts.map(shift => {
        const shiftDate = new Date(shift.date);
        const totalHours = calculateHours(shift.start, shift.end);
        const week = getWeekNumber(shift.date);
        
        let shiftContractHours = 0;
        let shiftExtraHours = 0;

        // I turni precedenti all'inizio contratto sono SEMPRE extra
        if (shiftDate < contractStart) {
            shiftExtraHours = totalHours;
        } else {
            // Ottieni le ore contrattuali già usate per QUESTA settimana
            const hoursUsed = weeklyContractHoursUsed[week] || 0;
            
            // Ore rimanenti nel budget contrattuale settimanale
            const hoursRemainingInContract = Math.max(0, contractHoursLimit - hoursUsed);

            // Split delle ore del turno
            shiftContractHours = Math.min(totalHours, hoursRemainingInContract);
            shiftExtraHours = totalHours - shiftContractHours;

            // Aggiorna il contatore settimanale delle ore contrattuali usate
            weeklyContractHoursUsed[week] = hoursUsed + shiftContractHours;
        }

        // Calcola i guadagni
        const earnings = (shiftContractHours * contractRate) + (shiftExtraHours * extraRate);

        return {
            ...shift,
            totalHours: totalHours,
            contractHours: shiftContractHours,
            extraHours: shiftExtraHours,
            earnings: earnings,
            week: week // Aggiungi la settimana per l'raggruppamento in tabella
        };
    });
}


// --- IMPORT MODULI ---
import { currentProfileId, isLoggedIn, loadProfilesList, populateProfileSelector, saveProfilesList, changeProfile } from './js/profiles.js';
import { shifts, parseCSV, generateCSV, addShift, deleteShift, editShift } from './js/shifts.js';
import { updateDashboard } from './js/dashboard.js';
import { calculateHours, getWeekNumber } from './js/utils.js';
import { openModal, closeModal } from './js/modals.js';

// --- INIZIALIZZAZIONE APP ---
window.initializeApp = async function() {
    await loadProfilesList();
    // ...gestione profili e dati come prima, ora delegata ai moduli...
    // ...gestione dashboard e UI...
};
// ...modularizzato: funzioni duplicate rimosse...
    const monthFilter = document.getElementById('monthFilter').value;
    const tbody = document.getElementById('shiftsBody');
    tbody.innerHTML = '';
    
    // 1. Ottieni l'array di turni pre-elaborati (con lo split corretto)
    const processedShifts = getProcessedShifts();

    // L'elemento "contractualHoursSubtitle" dovrebbe esistere nel tuo HTML
    const subtitleElement = document.getElementById('contractualHoursSubtitle');
    if (subtitleElement) {
        subtitleElement.textContent = `di ${SETTINGS.WEEKLY_HOURS} ore contrattuali`;
    }

    if (shifts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Nessun turno. Inizia ad aggiungerne uno.</td></tr>';
        updateDashboard();
        return;
    }
    // Se non loggato, mostra un messaggio di avviso
    if (!isLoggedIn) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #dc3545; font-weight: bold;">Accedi con il PIN per visualizzare e modificare lo storico dei turni.</td></tr>';
        updateDashboard(true);
        return;
    }

    const filteredShifts = monthFilter === 'all' ? processedShifts :
        processedShifts.filter(s => s.date.substring(0, 7) === monthFilter);

    let lastWeek = null;

    filteredShifts.forEach((shift, index) => {
        const week = shift.week;
        if (week !== lastWeek) {
            const weekRow = tbody.insertRow();
            weekRow.className = 'week-separator';
            const cell = weekRow.insertCell();
            cell.colSpan = 11;
            cell.textContent = `Settimana ${week.split('-W')[1]} (${week.split('-W')[0]})`;
            lastWeek = week;
        }
        const row = tbody.insertRow(); 
        const date = new Date(shift.date);
        const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        const originalIndex = shifts.findIndex(s => s.date === shift.date && s.start === shift.start && s.end === shift.end && s.notes === shift.notes);
        let statusLabel = shift.status === 'pagato' ? 'Pagato' : 'Da pagare';
        let statusHtml = `<span class="shift-status ${shift.status === 'pagato' ? 'paid' : 'unpaid'}">${statusLabel}</span>`;
        let actions = [];
        if (shift.extraHours > 0) {
            actions.push(`<button class="status-btn" onclick="toggleExtraStatus(${originalIndex})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-receipt-euro-icon lucide-receipt-euro"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 12h5"/><path d="M16 9.5a4 4 0 1 0 0 5.2"/></svg> ${shift.status === 'pagato' ? 'Segna da pagare' : 'Segna pagato'}</button>`);
        }
        actions.push(`<button class="edit-btn" onclick="openEditModal(${originalIndex})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen-icon lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg> Modifica</button>`);
        actions.push(`<button class="delete-btn" onclick="deleteShift(${originalIndex})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Elimina</button>`);
        row.innerHTML = `
            <td>${date.toLocaleDateString('it-IT')}</td>
            <td>${days[date.getDay()]}</td>
            <td>${shift.start}</td>
            <td>${shift.end}</td>
            <td><strong>${shift.totalHours.toFixed(2)}h</strong></td>
            <td class="contract-hours">${shift.contractHours.toFixed(2)}h</td>
            <td class="extra-hours">${shift.extraHours.toFixed(2)}h</td>
            <td><strong>€${shift.earnings.toFixed(2)}</strong></td>
            <td><span class='notes ${shift.notes === ""? "hidden": ""}'>${shift.notes || ''}</span></td>
            <td>${statusHtml}</td>
            <td class="actions-cell" style="text-align:center;">${actions.join(' ')}</td>
        `;
    });
    // ...funzioni modularizzate ora gestite nei rispettivi file...

// Funzione per cambiare lo stato di pagamento di un turno extra
function toggleExtraStatus(index) {
    if (!isLoggedIn) return;
    if (shifts[index].status === 'pagato') {
        shifts[index].status = 'da pagare';
    } else {
        shifts[index].status = 'pagato';
    }
    renderTable();
    autoSaveShiftsToServer();
}

function updateDashboard(obfuscated = false) {
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // 1. Ottieni l'array di turni pre-elaborati
    const processedShifts = getProcessedShifts();
    
    // Calcola il tasso orario contrattuale (per trasparenza)
    const contractRate = SETTINGS.OCTOBER_HOURS > 0 ? (SETTINGS.OCTOBER_PAYOUT / SETTINGS.OCTOBER_HOURS) : SETTINGS.EXTRA_RATE;
    // Aggiorna il display del tasso orario
    const rateDisplay = document.getElementById('calculatedRate');
    if (rateDisplay) {
        rateDisplay.textContent = contractRate.toFixed(4);
    }

    if (obfuscated) {
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('weekHours', '---');
        setText('monthHours', '---');
        setText('monthEarnings', '€---');
        setText('totalEarnings', '€---');
        setText('totalHours', '---h');
        setText('contractHoursTotal', '---h');
        setText('contractEarnings', '€--- guadagnati');
        setText('extraHoursTotal', '---h');
        setText('extraEarnings', '€--- guadagnati');
        setText('grandTotal', '€---');
        setText('grandTotalHours', '---h lavorate');
        setText('extraPaid', '€---');
        return;
    }
    // Aggiorna il già pagato extra
    updateExtraPaidDisplay();

    // Calcoli Dashboard Principale
    const weekHours = processedShifts.filter(s => s.week === currentWeek).reduce((sum, s) => sum + s.totalHours, 0);
    const monthContractHours = processedShifts.filter(s => s.date.startsWith(currentMonth)).reduce((sum, s) => sum + s.contractHours, 0);
    const monthExtraHours = processedShifts.filter(s => s.date.startsWith(currentMonth)).reduce((sum, s) => sum + s.extraHours, 0);
    const monthContractEarnings = monthContractHours * contractRate;
    const monthExtraEarnings = monthExtraHours * SETTINGS.EXTRA_RATE;
    const monthExtraPaid = processedShifts.filter(s => s.date.startsWith(currentMonth) && s.extraHours > 0 && s.status === 'pagato').reduce((sum, s) => sum + s.extraHours * SETTINGS.EXTRA_RATE, 0);
    const monthExtraToGive = monthExtraEarnings - monthExtraPaid;

    // RIMOSSO: input/tasto salvataggio extra già pagato (ora calcolato automaticamente)

    // Aggiornamento Dashboard Principale: SOLO BOX RICHIESTI
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('weekHours', weekHours.toFixed(2)); // Ore settimana corrente
    setText('monthHours', (monthContractHours + monthExtraHours).toFixed(2)); // Ore mese corrente
    setText('monthContractEarnings', `€${monthContractEarnings.toFixed(2)}`); // Guadagno mese in busta
    setText('monthExtraEarnings', `€${monthExtraEarnings.toFixed(2)}`); // Guadagno mese extra
    setText('monthExtraPaid', `€${monthExtraPaid.toFixed(2)}`); // Già pagato mese extra (calcolato)
    setText('monthExtraToGive', `€${monthExtraToGive.toFixed(2)}`); // Da avere mese extra (calcolato)
    // RIMOSSO: input/tasto salvataggio extra già pagato
    // Aggiorna nome mese
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    setText('monthName', `${monthNames[now.getMonth()]} ${now.getFullYear()}`);
    const payslipMonthName = document.getElementById('payslipMonthName');
    if (payslipMonthName) payslipMonthName.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const payslipBtn = document.getElementById('payslipBtn');
    if (payslipBtn) payslipBtn.style.display = isLoggedIn ? '' : 'none';
    // RIMOSSO: riepilogo dettagliato non richiesto nei box principali
}

function saveExtraPaid() {
    if (!isLoggedIn) return;
    const val = parseFloat(document.getElementById('extraPaidInput').value);
    SETTINGS.EXTRA_PAID = isNaN(val) ? 0 : val;
    saveSettingsToServer();
    updateDashboard();
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    const detailMonthFilter = document.getElementById('detailMonthFilter');
    while (monthFilter.options.length > 1) monthFilter.remove(1);
    while (detailMonthFilter.options.length > 0) detailMonthFilter.remove(0);
    const months = new Set();
    shifts.forEach(shift => months.add(shift.date.substring(0, 7)));
    const sortedMonths = Array.from(months).sort().reverse();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const optionCurrent = document.createElement('option');
    optionCurrent.value = currentMonthKey;
    optionCurrent.textContent = currentMonthName;
    detailMonthFilter.appendChild(optionCurrent);
    sortedMonths.forEach(monthKey => {
        if (monthKey === currentMonthKey) return;
        const [year, monthIndex] = monthKey.split('-').map(Number);
        const monthName = `${monthNames[monthIndex - 1]} ${year}`;
        const optionTable = document.createElement('option');
        optionTable.value = monthKey;
        optionTable.textContent = monthName;
        monthFilter.appendChild(optionTable);
        const optionDetail = document.createElement('option');
        optionDetail.value = monthKey;
        optionDetail.textContent = monthName;
        detailMonthFilter.appendChild(optionDetail);
    });
}

function filterData() {
    renderTable();
}

function setDetailView(view) {
    const btnTotal = document.getElementById('btnTotal');
    const select = document.getElementById('detailMonthFilter');
    const allDetailButtons = document.querySelectorAll('.detail-controls button');
    allDetailButtons.forEach(btn => btn.classList.add('btn-secondary-style'));
    if (view === 'total') {
        detailView = 'total';
        btnTotal.classList.remove('btn-secondary-style');
        select.selectedIndex = 0;
    } else {
        detailView = 'custom';
        selectedDetailMonth = select.value;
    }
    updateDashboard();
}

// --- Funzioni Modale Impostazioni ---

function openSettingsModal() {
    if (!isLoggedIn) {
        alert("Accedi al profilo (PIN) per modificare le impostazioni.");
        return;
    }
    
    // Calcola e mostra il tasso orario di riferimento
    const contractRate = SETTINGS.OCTOBER_HOURS > 0 ? (SETTINGS.OCTOBER_PAYOUT / SETTINGS.OCTOBER_HOURS) : SETTINGS.EXTRA_RATE;

    document.getElementById('contractStartDate').value = SETTINGS.CONTRACT_START;
    document.getElementById('weeklyHours').value = SETTINGS.WEEKLY_HOURS;
    document.getElementById('lastPayHours').value = SETTINGS.OCTOBER_HOURS;
    document.getElementById('lastPayNet').value = SETTINGS.OCTOBER_PAYOUT;
    document.getElementById('extraRateInput').value = SETTINGS.EXTRA_RATE;
    
    // AGGIUNTA SICUREZZA: Aggiorna solo se l'elemento esiste (nuovo ID)
    const rateDisplay = document.getElementById('calculatedRate');
    if (rateDisplay) {
        rateDisplay.textContent = contractRate.toFixed(4); // Mostra 4 decimali per chiarezza
    }
    
    document.getElementById('settingsModal').style.display = 'flex';
}

async function saveSettings() {
    const startDate = document.getElementById('contractStartDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value);
    const payHours = parseFloat(document.getElementById('lastPayHours').value);
    const payNet = parseFloat(document.getElementById('lastPayNet').value);
    const extraRate = parseFloat(document.getElementById('extraRateInput').value);

    if (!startDate || isNaN(weeklyHours) || isNaN(payHours) || isNaN(payNet) || isNaN(extraRate)) {
        alert('Compila tutti i campi con valori numerici validi (o una data).');
        return;
    }

    SETTINGS.CONTRACT_START = startDate;
    SETTINGS.WEEKLY_HOURS = weeklyHours;
    SETTINGS.OCTOBER_HOURS = payHours;
    SETTINGS.OCTOBER_PAYOUT = payNet;
    SETTINGS.EXTRA_RATE = extraRate;
    
    closeModal('settingsModal');

    await saveSettingsToServer();
    
    // Ricalcola tutto con le nuove impostazioni
    renderTable();
    updateDashboard();
}

// --- Funzioni Busta Paga ---
function openPayslipModal() {
    const now = new Date();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    document.getElementById('modalPayslipMonth').textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    // Precompila i dati attuali
    document.getElementById('modalPayHours').value = SETTINGS.OCTOBER_HOURS;
    document.getElementById('modalPayNet').value = SETTINGS.OCTOBER_PAYOUT;
    document.getElementById('payslipModal').style.display = 'flex';
}

function confirmPayslip() {
    if (!isLoggedIn) return;
    // Prendi i dati dalla modale
    const payHours = parseFloat(document.getElementById('modalPayHours').value);
    const payNet = parseFloat(document.getElementById('modalPayNet').value);
    if (isNaN(payHours) || isNaN(payNet)) {
        alert('Compila tutti i campi con valori numerici validi.');
        return;
    }
    // Aggiorna SETTINGS
    SETTINGS.OCTOBER_HOURS = payHours;
    SETTINGS.OCTOBER_PAYOUT = payNet;
    saveSettingsToServer();
    // Aggiorna lo stato dei turni del mese corrente a "pagato"
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    shifts.forEach(shift => {
        if (shift.date.startsWith(currentMonth)) {
            shift.status = 'pagato';
        }
    });
    autoSaveShiftsToServer();
    renderTable();
    updateDashboard();
    closeModal('payslipModal');
}