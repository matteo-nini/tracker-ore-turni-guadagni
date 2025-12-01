<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['action']) || !isset($data['shift'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);
$action = $data['action']; // 'add', 'edit', 'delete'
$shift = $data['shift'];
$shiftIndex = isset($data['shiftIndex']) ? intval($data['shiftIndex']) : null;

$calendarDir = dirname(__DIR__) . '/calendar';
$globalShiftsFile = $calendarDir . '/global_shifts.json';
$logFile = $calendarDir . '/changes_log.txt';

// Create calendar directory if it doesn't exist
if (!is_dir($calendarDir)) {
    mkdir($calendarDir, 0755, true);
}

// Load existing shifts
$shifts = [];
if (file_exists($globalShiftsFile)) {
    $shifts = json_decode(file_get_contents($globalShiftsFile), true);
} else {
    file_put_contents($globalShiftsFile, json_encode([], JSON_PRETTY_PRINT));
}

// Perform action
$logMessage = '';
$timestamp = date('Y-m-d H:i:s');

switch ($action) {
    case 'add':
        // Add unique ID to shift
        $shift['id'] = uniqid('shift_', true);
        $shifts[] = $shift;
        $logMessage = "[{$timestamp}] {$username} ha aggiunto un turno per {$shift['assignedTo']} in data {$shift['date']} dalle {$shift['start']} alle {$shift['end']}";
        break;
    
    case 'edit':
        if ($shiftIndex !== null && isset($shifts[$shiftIndex])) {
            $oldShift = $shifts[$shiftIndex];
            $shifts[$shiftIndex] = array_merge($oldShift, $shift);
            $logMessage = "[{$timestamp}] {$username} ha modificato il turno di {$oldShift['assignedTo']} del {$oldShift['date']} ({$oldShift['start']}-{$oldShift['end']}) → nuovo: {$shift['assignedTo']} {$shift['date']} ({$shift['start']}-{$shift['end']})";
        }
        break;
    
    case 'delete':
        if ($shiftIndex !== null && isset($shifts[$shiftIndex])) {
            $deletedShift = $shifts[$shiftIndex];
            array_splice($shifts, $shiftIndex, 1);
            $logMessage = "[{$timestamp}] {$username} ha eliminato il turno di {$deletedShift['assignedTo']} del {$deletedShift['date']} ({$deletedShift['start']}-{$deletedShift['end']})";
        }
        break;
}

// Save shifts
file_put_contents($globalShiftsFile, json_encode($shifts, JSON_PRETTY_PRINT));

// Write to log
if ($logMessage) {
    file_put_contents($logFile, $logMessage . "\n", FILE_APPEND);
}

echo json_encode(['success' => true]);
?>