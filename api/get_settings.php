<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

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