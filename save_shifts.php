<?php
// Script per salvare i turni CSV in base al profilo
header('Content-Type: text/plain');

// Verifica e sanifica il nome del profilo dall'URL
if (!isset($_GET['profile'])) {
    http_response_code(400);
    die("Errore: Nome del profilo mancante nell'URL.");
}
// Rimuove caratteri non validi per i nomi dei file
$profileName = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['profile']);
$file = $profileName . '_shifts.csv'; // Nome file dinamico

$data = file_get_contents('php://input');

if ($data) {
    $success = file_put_contents($file, $data);

    if ($success !== false) {
        http_response_code(200);
        echo "Turni salvati con successo per il profilo " . $profileName;
    } else {
        http_response_code(500);
        echo "Errore durante la scrittura del file " . $file . ". Controlla i permessi di scrittura.";
    }
} else {
    http_response_code(400);
    echo "Nessun dato ricevuto dalla richiesta.";
}
?>