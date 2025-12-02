<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

$calendarDir = dirname(__DIR__) . '/calendar';
$globalShiftsFile = $calendarDir . '/global_shifts.json';

// Create calendar directory if it doesn't exist
if (!is_dir($calendarDir)) {
    mkdir($calendarDir, 0755, true);
}

// Create global shifts file if it doesn't exist
if (!file_exists($globalShiftsFile)) {
    file_put_contents($globalShiftsFile, json_encode([], JSON_PRETTY_PRINT));
}

$shifts = json_decode(file_get_contents($globalShiftsFile), true);

echo json_encode($shifts);
?>