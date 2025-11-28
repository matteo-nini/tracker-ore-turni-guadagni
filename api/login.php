<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['password'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);
$password = $data['password'];

// Percorso corretto dalla cartella php
$profilesFile = dirname(__DIR__) . '/profiles/profiles.json';

if (!file_exists($profilesFile)) {
    echo json_encode(['success' => false, 'message' => 'Nessun profilo trovato']);
    exit;
}

$profiles = json_decode(file_get_contents($profilesFile), true);

if (isset($profiles[$username])) {
    if (password_verify($password, $profiles[$username]['password'])) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Password errata']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Utente non trovato']);
}
?>