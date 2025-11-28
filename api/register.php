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

$username = $data['username'];
$password = $data['password'];

// Validate username
if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username non valido (3-20 caratteri, solo lettere, numeri e underscore)']);
    exit;
}

$profilesDir = dirname(__DIR__) . '/profiles';
$profilesFile = $profilesDir . '/profiles.json';

// Create profiles directory if it doesn't exist
if (!is_dir($profilesDir)) {
    mkdir($profilesDir, 0755, true);
}

// Load existing profiles
$profiles = [];
if (file_exists($profilesFile)) {
    $profiles = json_decode(file_get_contents($profilesFile), true);
}

// Check if username already exists
if (isset($profiles[$username])) {
    echo json_encode(['success' => false, 'message' => 'Username già esistente']);
    exit;
}

// Create user directory
$userDir = $profilesDir . '/' . $username;
if (!is_dir($userDir)) {
    mkdir($userDir, 0755, true);
}

// Create default settings
$defaultSettings = [
    'contractStartDate' => '2024-10-21',
    'weeklyHours' => 18,
    'extraRate' => 10
];

file_put_contents($userDir . '/settings.json', json_encode($defaultSettings, JSON_PRETTY_PRINT));

// Create empty shifts CSV
$shiftsCSV = "Data,Entrata,Uscita,Note,Stato\n";
file_put_contents($userDir . '/shifts.csv', $shiftsCSV);

// Add user to profiles
$profiles[$username] = [
    'password' => password_hash($password, PASSWORD_DEFAULT),
    'created' => date('Y-m-d H:i:s')
];

file_put_contents($profilesFile, json_encode($profiles, JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);
?>