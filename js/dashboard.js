// --- MODULO: Gestione Dashboard ---

// Funzione per aggiornare la dashboard
export function updateDashboard() {
    const processedShifts = getProcessedShifts();

    const totalHours = processedShifts.reduce((sum, shift) => sum + shift.totalHours, 0);
    const contractHours = processedShifts.reduce((sum, shift) => sum + shift.contractHours, 0);
    const extraHours = processedShifts.reduce((sum, shift) => sum + shift.extraHours, 0);
    const totalEarnings = processedShifts.reduce((sum, shift) => sum + shift.earnings, 0);

    document.getElementById('totalHours').textContent = totalHours.toFixed(2);
    document.getElementById('contractHours').textContent = contractHours.toFixed(2);
    document.getElementById('extraHours').textContent = extraHours.toFixed(2);
    document.getElementById('totalEarnings').textContent = `€ ${totalEarnings.toFixed(2)}`;
}