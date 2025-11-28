<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['shifts'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);
$shifts = $data['shifts'];

$shiftsFile = dirname(__DIR__) . '/profiles/' . $username . '/shifts.csv';

if (file_put_contents($shiftsFile, $shifts)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Errore durante il salvataggio']);
}
?>