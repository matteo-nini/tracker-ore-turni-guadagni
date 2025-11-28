<?php
header('Content-Type: text/csv');
header('Access-Control-Allow-Origin: *');

// Verifica che il parametro username sia fornito
if (!isset($_GET['username']) || empty(trim($_GET['username']))) {
    echo "Errore: username non specificato\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

// Sanitize del parametro username
$username = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['username']);

// Percorso del file shifts.csv
$shiftsFile = dirname(__DIR__) . "/profiles/$username/shifts.csv";
// Verifica che il file esista
if (!file_exists($shiftsFile)) {
    echo "Errore: file non trovato ($shiftsFile)\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

// Leggi il contenuto del file
$content = file_get_contents($shiftsFile);
if ($content === false) {
    echo "Errore: impossibile leggere il file ($shiftsFile)\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

// Verifica che il file non sia vuoto
if (empty(trim($content))) {
    echo "Errore: file vuoto o senza dati ($shiftsFile)\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

// Restituisci il contenuto del file
echo $content;
?>