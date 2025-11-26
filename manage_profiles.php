<?php
// Script per salvare la lista dei profili (profiles.json)
header('Content-Type: text/plain');

// Nome del file di configurazione principale
$file = 'profiles.json';

$data = file_get_contents('php://input');

if ($data) {
    // Formatta il JSON per renderlo leggibile sul server
    $json_data = json_encode(json_decode($data), JSON_PRETTY_PRINT);
    
    $success = file_put_contents($file, $json_data);

    if ($success !== false) {
        http_response_code(200);
        echo "Lista profili salvata con successo.";
    } else {
        http_response_code(500);
        echo "Errore durante la scrittura del file " . $file . ". Controlla i permessi di scrittura.";
    }
} else {
    http_response_code(400);
    echo "Nessun dato ricevuto dalla richiesta.";
}
?>