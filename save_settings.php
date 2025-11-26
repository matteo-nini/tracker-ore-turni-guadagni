<?php
// Script per salvare le impostazioni JSON in base al profilo
header('Content-Type: text/plain');

// Verifica e sanifica il nome del profilo dall'URL
if (!isset($_GET['profile'])) {
    http_response_code(400);
    die("Errore: Nome del profilo mancante nell'URL.");
}
$profileName = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['profile']);
$file = $profileName . '_settings.json'; // Nome file dinamico

$data = file_get_contents('php://input');

if ($data) {
    // Formatta il JSON per renderlo leggibile sul server
    $json_data = json_encode(json_decode($data), JSON_PRETTY_PRINT);
    
    $success = file_put_contents($file, $json_data);

    if ($success !== false) {
        http_response_code(200);
        echo "Impostazioni salvate con successo per il profilo " . $profileName;
    } else {
        http_response_code(500);
        echo "Errore durante la scrittura del file " . $file . ". Controlla i permessi di scrittura.";
    }
} else {
    http_response_code(400);
    echo "Nessun dato ricevuto dalla richiesta.";
}
?>