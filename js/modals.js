// --- MODULO: Gestione Modali ---

// Funzione per aprire una modale
export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error(`Modal con ID '${id}' non trovato.`);
    }
}

// Funzione per chiudere una modale
export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error(`Modal con ID '${id}' non trovato.`);
    }
}