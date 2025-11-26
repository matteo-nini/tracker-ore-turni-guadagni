// --- MODULO: Gestione Profili ---

// Variabili globali esportate
export let PROFILES = [];
export let currentProfileId = null;
export let isLoggedIn = false;

// Funzione per caricare la lista dei profili
export async function loadProfilesList() {
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

// Funzione per popolare il selettore dei profili
export function populateProfileSelector() {
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

// Funzione per salvare la lista dei profili
export function saveProfilesList() {
    fetch(MANAGE_PROFILES_SCRIPT_PATH, {
        method: 'POST',
        body: JSON.stringify(PROFILES),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (!response.ok) throw new Error('Errore salvataggio lista profili');
        console.log('Lista profili salvata.');
    }).catch(error => console.error(error.message));
}

// Funzione per cambiare profilo
export function changeProfile() {
    const newProfileId = document.getElementById('profileSelector').value;
    if (newProfileId && newProfileId !== currentProfileId) {
        window.location.href = `?profile=${newProfileId}`;
    } else {
        closeModal('loginModal');
    }
}