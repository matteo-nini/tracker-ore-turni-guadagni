<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

require_once dirname(__DIR__) . '/config/database.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['action']) || !isset($data['shift'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = trim($data['username']);
$action = $data['action']; // 'add', 'edit', 'delete'
$shift = $data['shift'];
$shiftId = isset($data['shiftId']) ? intval($data['shiftId']) : null;

try {
    $pdo = getDB();

    // Get user ID
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Utente non trovato']);
        exit;
    }

    $userId = $user['id'];

    switch ($action) {
        case 'add':
            $stmt = $pdo->prepare("INSERT INTO global_shifts (assigned_to_user_id, date, start_time, end_time, notes, status, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $userId,
                $shift['date'],
                $shift['start_time'],
                $shift['end_time'],
                $shift['notes'],
                $shift['status'],
                $userId
            ]);
            break;

        case 'edit':
            if ($shiftId) {
                $stmt = $pdo->prepare("UPDATE global_shifts SET date = ?, start_time = ?, end_time = ?, notes = ?, status = ? WHERE id = ? AND assigned_to_user_id = ?");
                $stmt->execute([
                    $shift['date'],
                    $shift['start_time'],
                    $shift['end_time'],
                    $shift['notes'],
                    $shift['status'],
                    $shiftId,
                    $userId
                ]);
            }
            break;

        case 'delete':
            if ($shiftId) {
                $stmt = $pdo->prepare("DELETE FROM global_shifts WHERE id = ? AND assigned_to_user_id = ?");
                $stmt->execute([$shiftId, $userId]);
            }
            break;
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    error_log("Global shift save error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore durante il salvataggio']);
}
?>