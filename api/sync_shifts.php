<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username'])) {
    echo json_encode(['success' => false, 'message' => 'Username mancante']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);

$calendarDir = dirname(__DIR__) . '/calendar';
$globalShiftsFile = $calendarDir . '/global_shifts.json';
$userShiftsFile = dirname(__DIR__) . '/profiles/' . $username . '/shifts.csv';

// Create calendar directory if it doesn't exist
if (!is_dir($calendarDir)) {
    mkdir($calendarDir, 0755, true);
}

// Load global shifts
$globalShifts = [];
if (file_exists($globalShiftsFile)) {
    $globalShifts = json_decode(file_get_contents($globalShiftsFile), true);
}

// Load user's personal shifts
$userShifts = [];
if (file_exists($userShiftsFile)) {
    $csv = file_get_contents($userShiftsFile);
    $lines = explode("\n", trim($csv));
    
    // Skip header
    for ($i = 1; $i < count($lines); $i++) {
        $line = trim($lines[$i]);
        if (empty($line)) continue;
        
        $parts = str_getcsv($line);
        if (count($parts) >= 5) {
            $userShifts[] = [
                'date' => $parts[0],
                'start' => $parts[1],
                'end' => $parts[2],
                'notes' => $parts[3],
                'status' => $parts[4],
                'assignedTo' => $username
            ];
        }
    }
}

// Add user shifts to global shifts if not already present
$added = 0;
foreach ($userShifts as $userShift) {
    $exists = false;
    
    foreach ($globalShifts as $globalShift) {
        if ($globalShift['date'] === $userShift['date'] &&
            $globalShift['start'] === $userShift['start'] &&
            $globalShift['end'] === $userShift['end'] &&
            $globalShift['assignedTo'] === $username) {
            $exists = true;
            break;
        }
    }
    
    if (!$exists) {
        $userShift['id'] = uniqid('shift_', true);
        $globalShifts[] = $userShift;
        $added++;
    }
}

// Save updated global shifts
file_put_contents($globalShiftsFile, json_encode($globalShifts, JSON_PRETTY_PRINT));

echo json_encode([
    'success' => true,
    'added' => $added,
    'message' => $added > 0 ? "{$added} turni sincronizzati" : "Nessun nuovo turno da sincronizzare"
]);
?>