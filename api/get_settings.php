<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if (!isset($_GET['username'])) {
    echo json_encode(['error' => 'Username mancante']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['username']); // Sanitize
$settingsFile = dirname(__DIR__) . '/profiles/' . $username . '/settings.json';

if (!file_exists($settingsFile)) {
    // Return default settings
    echo json_encode([
        'contractStartDate' => '2024-10-21',
        'weeklyHours' => 18,
        'extraRate' => 10
    ]);
    exit;
}

$settings = file_get_contents($settingsFile);
echo $settings;
?>