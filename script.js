// --- CONSTANTI E STATO GLOBALE ---
let PROFILES = [];
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
        document.querySelector('.table-section').style.display = 'none';
        document.querySelector('.input-section').style.display = 'none';
    } else {
        body.classList.remove('data-obfuscated');
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

    if (!profile) {
        console.error('Profilo non trovato.');
        return;
    }

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
        console.log(csvText);
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


// --- MODULO: Gestione Profili ---

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

// --- MODULO: Gestione Turni ---

// Funzione per visualizzare i turni nella tabella
function renderTable() {
    const tableBody = document.getElementById('shiftsBody');
    if (!tableBody) {
        console.error("Elemento con ID 'shiftsBody' non trovato.");
        return;
    }

    // Pulisci la tabella
    tableBody.innerHTML = '';

    // Ottieni i turni processati
    const processedShifts = getProcessedShifts();

    // Aggiungi ogni turno come riga nella tabella
    processedShifts.forEach((shift, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${shift.date}</td>
            <td>${new Date(shift.date).toLocaleDateString('it-IT', { weekday: 'long' })}</td>
            <td>${shift.start}</td>
            <td>${shift.end}</td>
            <td>${shift.totalHours.toFixed(2)}</td>
            <td>${shift.contractHours.toFixed(2)}</td>
            <td>${shift.extraHours.toFixed(2)}</td>
            <td>€ ${shift.earnings.toFixed(2)}</td>
            <td>${shift.notes || ''}</td>
            <td class="shift-status ${shift.status === 'pagato' ? 'paid' : 'unpaid'}">${shift.status}</td>
            <td class="actions-cell">
                <button class="edit-btn" onclick="openEditModal(${index})">Modifica</button>
                <button class="delete-btn" onclick="deleteShift(${index})">Elimina</button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// --- MODULO: Gestione Dashboard ---
function updateDashboard() {
    const processedShifts = getProcessedShifts();

    const totalHours = processedShifts.reduce((sum, shift) => sum + shift.totalHours, 0);
    const contractHours = processedShifts.reduce((sum, shift) => sum + shift.contractHours, 0);
    const extraHours = processedShifts.reduce((sum, shift) => sum + shift.extraHours, 0);
    const totalEarnings = processedShifts.reduce((sum, shift) => sum + shift.earnings, 0);

    // Aggiunto controllo per verificare l'esistenza dell'elemento prima di accedere a textContent
    const totalHoursElement = document.getElementById('totalHours');
    if (totalHoursElement) {
        totalHoursElement.textContent = totalHours.toFixed(2);
    } else {
        console.warn("Elemento con ID 'totalHours' non trovato.");
    }

    const contractHoursElement = document.getElementById('contractHoursTotal');
    if (contractHoursElement) {
        contractHoursElement.textContent = contractHours.toFixed(2);
    } else {
        console.warn("Elemento con ID 'contractHoursTotal' non trovato.");
    }

    const extraHoursElement = document.getElementById('extraHoursTotal');
    if (extraHoursElement) {
        extraHoursElement.textContent = extraHours.toFixed(2);
    } else {
        console.warn("Elemento con ID 'extraHoursTotal' non trovato.");
    }

    const totalEarningsElement = document.getElementById('grandTotal');
    if (totalEarningsElement) {
        totalEarningsElement.textContent = `€ ${totalEarnings.toFixed(2)}`;
    } else {
        console.warn("Elemento con ID 'grandTotal' non trovato.");
    }
}

// --- MODULO: Funzioni di Utilità ---

// --- MODULO: Gestione Modali ---
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error(`Modal con ID '${id}' non trovato.`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error(`Modal con ID '${id}' non trovato.`);
    }
}

// Funzione per popolare il filtro dei mesi
function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) {
        console.error("Elemento con ID 'monthFilter' non trovato.");
        return;
    }

    // Ottieni tutti i mesi unici dai turni
    const uniqueMonths = [...new Set(shifts.map(shift => shift.date.slice(0, 7)))];

    // Ordina i mesi in ordine decrescente
    uniqueMonths.sort((a, b) => b.localeCompare(a));

    // Pulisci il filtro e aggiungi l'opzione "Tutti i mesi"
    monthFilter.innerHTML = '<option value="all">Tutti i mesi</option>';

    // Aggiungi ogni mese come opzione
    uniqueMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = new Date(`${month}-01`).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        monthFilter.appendChild(option);
    });
}

// --- INIZIALIZZAZIONE APP ---
initializeApp();