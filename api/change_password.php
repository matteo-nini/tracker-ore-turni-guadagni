<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['currentPassword']) || !isset($data['newPassword'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);
$currentPassword = $data['currentPassword'];
$newPassword = $data['newPassword'];

$profilesFile = dirname(__DIR__) . '/profiles/profiles.json';

if (!file_exists($profilesFile)) {
    echo json_encode(['success' => false, 'message' => 'Profili non trovati']);
    exit;
}

$profiles = json_decode(file_get_contents($profilesFile), true);

if (!isset($profiles[$username])) {
    echo json_encode(['success' => false, 'message' => 'Utente non trovato']);
    exit;
}

// Verify current password
if (!password_verify($currentPassword, $profiles[$username]['password'])) {
    echo json_encode(['success' => false, 'message' => 'Password attuale errata']);
    exit;
}

// Update password
$profiles[$username]['password'] = password_hash($newPassword, PASSWORD_DEFAULT);

if (file_put_contents($profilesFile, json_encode($profiles, JSON_PRETTY_PRINT))) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Errore durante il salvataggio']);
}
?>