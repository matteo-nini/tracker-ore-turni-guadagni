// --- MODULO: Gestione Turni ---

// Variabili globali esportate
export let shifts = [];

// Funzione per parsare il CSV
export function parseCSV(csvText) {
    const normalizedText = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim() !== '');

    const newShifts = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split(',');
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

// Funzione per generare il CSV
export function generateCSV() {
    let csv = 'Data,Entrata,Uscita,Note,Stato\n'; 
    const sortedShifts = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedShifts.forEach(shift => {
        csv += `${shift.date},${shift.start},${shift.end},${shift.notes || ''},${shift.status || 'da pagare'}\n`; 
    });
    return csv;
}

// Funzione per aggiungere un turno
export function addShift(date, start, end, notes) {
    shifts.push({ date, start, end, notes, status: 'da pagare' });
}

// Funzione per eliminare un turno
export function deleteShift(index) {
    shifts.splice(index, 1);
}

// Funzione per modificare un turno
export function editShift(index, date, start, end, notes) {
    shifts[index] = { date, start, end, notes };
}