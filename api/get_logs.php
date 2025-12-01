<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if (!isset($_GET['username'])) {
    echo json_encode(['error' => 'Username mancante']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['username']);

// Check if user is admin
$profilesFile = dirname(__DIR__) . '/profiles/profiles.json';
if (!file_exists($profilesFile)) {
    echo json_encode(['error' => 'Profili non trovati']);
    exit;
}

$profiles = json_decode(file_get_contents($profilesFile), true);

if (!isset($profiles[$username]) || $profiles[$username]['role'] !== 'admin') {
    echo json_encode(['error' => 'Accesso negato']);
    exit;
}

// Read log file
$logFile = dirname(__DIR__) . '/calendar/changes_log.txt';

if (!file_exists($logFile)) {
    echo json_encode(['logs' => []]);
    exit;
}

$logs = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$logs = array_reverse($logs); // Most recent first

echo json_encode(['logs' => $logs]);
?>